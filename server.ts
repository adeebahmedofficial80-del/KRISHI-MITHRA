import 'dotenv/config';
import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI, ThinkingLevel} from '@google/genai';
import {generatePersonalizedDailyBriefing} from './src/server/briefingService';
import {marketService} from './src/server/marketService';
import {getDynamicWeatherForecast} from './src/server/weatherService';
import {LanguageCode} from './src/types/krishi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

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

  // Start background daily market sync scheduler
  marketService.startDailyScheduler();

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'krishi-mithra',
      timestamp: new Date().toISOString(),
      integrations: {
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        agmarknetConfigured: Boolean(process.env.DATA_GOV_IN_API_KEY),
        imdConfigured: Boolean(process.env.IMD_API_KEY && process.env.IMD_API_BASE_URL),
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

  // ==================== DYNAMIC MARKET DATA PIPELINE (AGMARKNET) ====================
  app.get('/api/market/status', (_req, res) => {
    res.json(marketService.getStatus());
  });

  app.get('/api/market/prices', (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const preferredMandi =
      typeof req.query.preferredMandi === 'string' ? req.query.preferredMandi : undefined;

    const feed = marketService.getMarketFeed({state, district, preferredMandi});
    res.json(feed);
  });

  app.post('/api/market/sync', async (req, res) => {
    try {
      const state = typeof req.body?.state === 'string' ? req.body.state : undefined;
      const status = await marketService.syncFromAgmarknet({state, force: true});
      const feed = marketService.getMarketFeed({state});
      return res.json({status, observations: feed.observations});
    } catch (error: unknown) {
      console.error('Market sync route error:', error);
      return res.status(500).json({
        error: getErrMsg(error, 'Unable to synchronize AGMARKNET market prices.'),
      });
    }
  });

  // ==================== DYNAMIC WEATHER & IMD ADVISORIES ====================
  app.get('/api/weather/forecast', async (req, res) => {
    try {
      const locationId =
        typeof req.query.locationId === 'string' && req.query.locationId.trim()
          ? req.query.locationId.trim()
          : 'bengaluru-rural';
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
        taluk,
        savedCropIds,
        alertPrefs,
        forceRefresh,
      });
      return res.json(snapshot);
    } catch (error: unknown) {
      console.error('Weather forecast error:', error);
      return res.status(503).json({
        error: getErrMsg(
          error,
          'Live weather service is temporarily unreachable. Please retry shortly.',
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

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Check recent Indian mandi / APMC market price trends, arrival conditions, and seasonal context for ${cropName} around ${marketName || 'local APMC'}, ${locationName || 'India'}. Summarize clearly for a smallholder farmer in ${targetLang} using short bullet points. Distinguish verified market reports from general estimates and avoid promising future prices.`,
        config: {
          tools: [{googleSearch: {}}],
        },
      });

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

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.HIGH},
          systemInstruction: `You are KRISHI-MITHRA, a trusted Indian agricultural advisor speaking to smallholder farmers. Respond strictly in ${targetLang}. Use short, clear paragraphs and practical bullet points. Never make medical claims or guarantee future mandi prices; always advise weighing transport and grading costs before choosing a distant mandi.`,
        },
      });

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

  if (!IS_PROD) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KRISHI-MITHRA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
