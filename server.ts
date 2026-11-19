import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI, ThinkingLevel} from '@google/genai';
import {generatePersonalizedDailyBriefing} from './src/server/briefingService.ts';
import {marketService} from './src/server/marketService.ts';
import {getDynamicWeatherForecast} from './src/server/weatherService.ts';
import type {LanguageCode} from './src/types/krishi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DIST_PATH = path.resolve(__dirname, 'dist');
const HAS_DIST_BUILD = fs.existsSync(path.join(DIST_PATH, 'index.html'));
const IS_PROD =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.K_SERVICE) ||
  (process.env.npm_lifecycle_event === 'start' && HAS_DIST_BUILD);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getErrMsg(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message) return fallback;
  const raw = err.message.trim();
  if (raw.startsWith('{') && raw.includes('"error"')) {
    try {
      const parsed = JSON.parse(raw) as {error?: {message?: string; code?: number}};
      if (parsed.error?.code === 503 || parsed.error?.code === 429) {
        return 'AI service is briefly busy due to high demand. Please try again in a few seconds.';
      }
      if (parsed.error?.message) {
        return parsed.error.message;
      }
    } catch {
      // Fall through
    }
  }
  return raw;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  kn: 'Kannada (ಕನ್ನಡ)',
  hi: 'Hindi (हिंदी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
};

function parseLanguage(raw: unknown): LanguageCode {
  if (raw === 'kn' || raw === 'hi' || raw === 'te' || raw === 'ta') return raw;
  return 'en';
}

interface GroundingChunkLike {
  maps?: {uri?: string; title?: string};
  web?: {uri?: string; title?: string};
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '2mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'krishi-mithra',
      timestamp: new Date().toISOString(),
      integrations: {
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        geminiSearchGrounding: Boolean(process.env.GEMINI_API_KEY),
        weatherGeminiGrounded: Boolean(process.env.GEMINI_API_KEY),
        mapsConfigured: Boolean(
          process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY,
        ),
      },
    });
  });

  app.get('/api/config/maps', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({apiKey});
  });

  // ==================== DYNAMIC MARKET DATA PIPELINE (GEMINI GOOGLE SEARCH GROUNDING) ====================
  app.get('/api/market/status', (_req, res) => {
    res.json(marketService.getStatus());
  });

  app.get('/api/market/prices', async (req, res) => {
    try {
      const state = typeof req.query.state === 'string' ? req.query.state : undefined;
      const district = typeof req.query.district === 'string' ? req.query.district : undefined;
      const preferredMandi =
        typeof req.query.preferredMandi === 'string' ? req.query.preferredMandi : undefined;
      const cropsRaw = typeof req.query.crops === 'string' ? req.query.crops : '';
      const autoFetch = req.query.autoFetch === '1' || req.query.autoFetch === 'true';

      const cropIds = cropsRaw
        ? cropsRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];

      if (autoFetch && cropIds.length > 0 && marketService.isGeminiConfigured()) {
        const feed = await marketService.fetchGroundedMarketPrices({
          cropIds,
          state,
          district,
          preferredMandi,
          forceRefresh: false,
        });
        return res.json(feed);
      }

      const feed = marketService.getMarketFeed({state, district, preferredMandi});
      return res.json(feed);
    } catch (error: unknown) {
      console.error('Market prices route error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to load verified market prices right now.'),
      });
    }
  });

  app.post('/api/market/sync', async (req, res) => {
    try {
      const body = req.body ?? {};
      const state = typeof body.state === 'string' ? body.state : undefined;
      const district = typeof body.district === 'string' ? body.district : undefined;
      const preferredMandi =
        typeof body.preferredMandi === 'string' ? body.preferredMandi : undefined;
      const cropIds = Array.isArray(body.cropIds)
        ? body.cropIds
            .filter((c: unknown): c is string => typeof c === 'string')
            .map((c: string) => c.trim())
            .filter(Boolean)
            .slice(0, 6)
        : ['tomato', 'onion', 'potato', 'banana'];
      const forceRefresh = body.forceRefresh !== false;

      const feed = await marketService.fetchGroundedMarketPrices({
        cropIds,
        state,
        district,
        preferredMandi,
        forceRefresh,
      });
      return res.json(feed);
    } catch (error: unknown) {
      console.error('Market sync route error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to retrieve live market prices via Gemini Search.'),
      });
    }
  });

  app.post('/api/market/crop-search', async (req, res) => {
    try {
      const body = req.body ?? {};
      const cropId = typeof body.cropId === 'string' ? body.cropId.trim() : '';
      if (!cropId) {
        return res.status(400).json({error: 'cropId is required.'});
      }
      const state = typeof body.state === 'string' ? body.state : undefined;
      const district = typeof body.district === 'string' ? body.district : undefined;
      const preferredMandi =
        typeof body.preferredMandi === 'string' ? body.preferredMandi : undefined;
      const forceRefresh = Boolean(body.forceRefresh);

      const feed = await marketService.fetchGroundedMarketPrices({
        cropIds: [cropId],
        state,
        district,
        preferredMandi,
        forceRefresh,
      });
      return res.json(feed);
    } catch (error: unknown) {
      console.error('Crop search route error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to fetch live price for this crop right now.'),
      });
    }
  });

  // ==================== DYNAMIC WEATHER (GEMINI GOOGLE SEARCH GROUNDING) ====================
  app.get('/api/weather/forecast', async (req, res) => {
    try {
      const locationId =
        typeof req.query.locationId === 'string' && req.query.locationId.trim()
          ? req.query.locationId.trim()
          : 'bengaluru-rural';
      const state = typeof req.query.state === 'string' ? req.query.state.trim() : undefined;
      const district =
        typeof req.query.district === 'string' ? req.query.district.trim() : undefined;
      const taluk = typeof req.query.taluk === 'string' ? req.query.taluk.trim() : undefined;
      const cropsRaw = typeof req.query.crops === 'string' ? req.query.crops : '';
      const savedCropIds = cropsRaw
        ? cropsRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 40)
        : [];
      const forceRefresh = req.query.refresh === '1';

      const alertPrefs = {
        rain: req.query.prefRain !== '0',
        heavyRain: req.query.prefHeavyRain !== '0',
        temperature: req.query.prefTemp === '1',
        wind: req.query.prefWind !== '0',
        dailyForecast: req.query.prefDaily === '1',
      };

      const snapshot = await getDynamicWeatherForecast({
        locationId,
        state,
        district,
        taluk,
        savedCropIds,
        alertPrefs,
        forceRefresh,
      });
      return res.json(snapshot);
    } catch (error: unknown) {
      console.error('Weather forecast error:', error instanceof Error ? error.message : error);
      return res.status(503).json({
        error: getErrMsg(
          error,
          'Live weather retrieval via Gemini Search is temporarily unavailable. Please retry shortly.',
        ),
      });
    }
  });

  // ==================== GEMINI PERSONALIZED DAILY BRIEFING (LISTEN) ====================
  app.post('/api/ai/daily-briefing', async (req, res) => {
    try {
      const body = req.body ?? {};
      if (typeof body.farmerName !== 'string' || !body.farmerName.trim()) {
        return res.status(400).json({error: 'farmerName is required.'});
      }
      const farmerName = body.farmerName.trim().slice(0, 80);
      const locationId =
        typeof body.locationId === 'string' && body.locationId.trim()
          ? body.locationId.trim()
          : 'bengaluru-rural';
      const savedCropIds = Array.isArray(body.savedCropIds)
        ? body.savedCropIds.filter((c: unknown): c is string => typeof c === 'string').slice(0, 30)
        : [];

      const briefing = await generatePersonalizedDailyBriefing({
        farmerName,
        locationId,
        state: typeof body.state === 'string' ? body.state : undefined,
        district: typeof body.district === 'string' ? body.district : undefined,
        taluk: typeof body.taluk === 'string' ? body.taluk : undefined,
        preferredMandi: typeof body.preferredMandi === 'string' ? body.preferredMandi : undefined,
        savedCropIds,
        language: parseLanguage(body.language),
        forceRefresh: Boolean(body.forceRefresh),
      });

      return res.json(briefing);
    } catch (error: unknown) {
      console.error('Daily briefing error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to prepare your personalized voice briefing right now.'),
      });
    }
  });

  // ==================== LIVE MANDI & MARKET GROUNDING ====================
  app.post('/api/ai/mandi-grounding', async (req, res) => {
    try {
      const {cropName, marketName, locationName, mode = 'search', lat, lng, language = 'en'} =
        req.body ?? {};
      if (!cropName || typeof cropName !== 'string') {
        return res.status(400).json({error: 'cropName is required.'});
      }

      const ai = getAiClient();
      const targetLang = LANGUAGE_NAMES[language] ?? 'English';

      if (mode === 'maps') {
        const latitude = typeof lat === 'number' ? lat : 13.0258;
        const longitude = typeof lng === 'number' ? lng : 77.5488;
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Find active agricultural produce market yards (APMC mandis) and wholesale vegetable/fruit markets near ${locationName || 'Bengaluru Rural, Karnataka'} relevant for selling ${cropName}. Provide practical details (market names, areas, and typical timings if available) in simple ${targetLang}.`,
          config: {
            tools: [{googleMaps: {}}],
            toolConfig: {
              retrievalConfig: {
                latLng: {latitude, longitude},
              },
            },
          },
        });

        const chunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ??
          []) as GroundingChunkLike[];
        const sources = chunks
          .map((chunk) => {
            if (chunk.maps?.uri) {
              return {
                title: chunk.maps.title || 'Google Maps Place',
                uri: chunk.maps.uri,
                kind: 'maps' as const,
              };
            }
            if (chunk.web?.uri) {
              return {
                title: chunk.web.title || 'Web Source',
                uri: chunk.web.uri,
                kind: 'web' as const,
              };
            }
            return null;
          })
          .filter(Boolean);

        return res.json({
          text: response.text || '',
          sources,
          mode: 'maps',
          updatedAt: new Date().toISOString(),
        });
      }

      const searchPrompt = `Check recent Indian mandi / APMC market price trends, arrival conditions, and seasonal context for ${cropName} around ${marketName || 'local APMC'}, ${locationName || 'India'}. Summarize clearly for a smallholder farmer in ${targetLang} using short bullet points. Distinguish verified market reports from general estimates and avoid promising future prices.`;
      let response = null;
      let lastErr: unknown = null;
      for (const model of ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: searchPrompt,
            config: {
              tools: [{googleSearch: {}}],
            },
          });
          break;
        } catch (err: unknown) {
          lastErr = err;
        }
      }
      if (!response) {
        throw lastErr || new Error('Unable to fetch live mandi grounding right now.');
      }

      const chunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ??
        []) as GroundingChunkLike[];
      const sources = chunks
        .map((chunk) => {
          if (chunk.web?.uri) {
            return {
              title: chunk.web.title || 'Market Source',
              uri: chunk.web.uri,
              kind: 'web' as const,
            };
          }
          return null;
        })
        .filter(Boolean);

      return res.json({
        text: response.text || '',
        sources,
        mode: 'search',
        updatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error('Mandi grounding error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to fetch live mandi grounding right now.'),
      });
    }
  });

  // ==================== DEEP-THINKING FARMING & MARKET ADVISOR ====================
  app.post('/api/ai/advisor', async (req, res) => {
    try {
      const {question, cropContext, weatherContext, locationName, farmerName, language = 'en'} =
        req.body ?? {};
      if (!question || typeof question !== 'string') {
        return res.status(400).json({error: 'Please enter a farming or market question.'});
      }

      const ai = getAiClient();
      const targetLang = LANGUAGE_NAMES[language] ?? 'English';

      const prompt = [
        farmerName ? `Farmer Name: ${String(farmerName).slice(0, 80)}` : '',
        `Farmer Location: ${locationName || 'India'}`,
        cropContext ? `Selected Crop Context: ${JSON.stringify(cropContext)}` : '',
        weatherContext ? `Current Weather Context: ${JSON.stringify(weatherContext)}` : '',
        `Farmer Question: ${question}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const advisorSystemInstruction = `You are KRISHI-MITHRA, a trusted Indian agricultural advisor speaking to smallholder farmers. Respond strictly in ${targetLang}. Use short, clear paragraphs and practical bullet points. Never make medical claims or guarantee future mandi prices; always advise weighing transport and grading costs before choosing a distant mandi.`;

      let response = null;
      let lastErr: unknown = null;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
            systemInstruction: advisorSystemInstruction,
          },
        });
      } catch (err: unknown) {
        lastErr = err;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              systemInstruction: advisorSystemInstruction,
            },
          });
        } catch (fallbackErr: unknown) {
          lastErr = fallbackErr;
        }
      }

      if (!response) {
        throw lastErr || new Error('Unable to get advisor response right now.');
      }

      return res.json({
        answer: response.text || '',
        updatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error('Advisor error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to get advisor response right now.'),
      });
    }
  });

  // ==================== LOW-LATENCY QUICK SUMMARY ====================
  app.post('/api/ai/quick-summary', async (req, res) => {
    try {
      const {topic, payload, language = 'en'} = req.body ?? {};
      const ai = getAiClient();
      const targetLang = LANGUAGE_NAMES[language] ?? 'English';

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Create a calm, concise 2-3 sentence spoken summary in ${targetLang} for an Indian farmer about ${topic || 'today market and weather'}: ${JSON.stringify(payload)}`,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.MINIMAL},
          systemInstruction:
            'Keep sentences short, numeric values crystal clear (e.g. rupees per kilogram, degrees Celsius), and plain spoken language suitable for audio readout.',
        },
      });

      return res.json({summary: response.text || ''});
    } catch (error: unknown) {
      console.error('Quick summary error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to generate quick summary.'),
      });
    }
  });

  // ==================== LOW-LATENCY SINGLE-SPEAKER TTS (gemini-3.8-flash-lite-tts) ====================
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const {text} = req.body ?? {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({error: 'Text is required for audio readout.'});
      }

      const ai = getAiClient();
      const trimmed = text.trim().slice(0, 1400);

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{text: trimmed}],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {voiceName: 'Kore'},
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Audio = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (!base64Audio) {
        return res.status(502).json({error: 'No audio returned by TTS service.'});
      }

      return res.json({audioBase64: base64Audio, mimeType});
    } catch (error: unknown) {
      console.error('TTS error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to generate speech audio right now.'),
      });
    }
  });

  const mountStaticDist = () => {
    app.use(express.static(DIST_PATH));
    app.get('*', (_req, res) => {
      const indexFile = path.join(DIST_PATH, 'index.html');
      if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile);
      }
      return res.status(503).send('Production bundle not found. Run npm run build first.');
    });
  };

  if (!IS_PROD) {
    try {
      const {createServer: createViteServer} = await import('vite');
      const vite = await createViteServer({
        server: {middlewareMode: true, hmr: false},
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      if (HAS_DIST_BUILD) {
        console.warn('Vite dev middleware unavailable; serving static dist/ bundle.');
        mountStaticDist();
      } else {
        throw viteErr;
      }
    }
  } else {
    mountStaticDist();
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `KRISHI-MITHRA server listening on http://0.0.0.0:${PORT} (mode=${IS_PROD ? 'production' : 'development'})`,
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
