import 'dotenv/config';
import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI, ThinkingLevel} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getAiClient() {
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

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  kn: 'Kannada (ಕನ್ನಡ)',
  hi: 'Hindi (हिंदी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
};

async function startServer() {
  const app = express();
  app.use(express.json({limit: '2mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({status: 'ok', service: 'krishi-mitra'});
  });

  app.get('/api/config/maps', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({apiKey});
  });

  // Live Mandi & Market Context via Gemini Search or Maps Grounding
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

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const sources = chunks
          .map((chunk: any) => {
            if (chunk.maps?.uri) {
              return {
                title: chunk.maps.title || 'Google Maps Place',
                uri: chunk.maps.uri,
                kind: 'maps',
              };
            }
            if (chunk.web?.uri) {
              return {
                title: chunk.web.title || 'Web Source',
                uri: chunk.web.uri,
                kind: 'web',
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
        contents: `Check recent Indian mandi / APMC market price trends, arrival conditions, and seasonal context for ${cropName} around ${marketName || 'Bengaluru APMC'}, ${locationName || 'Karnataka'}. Summarize clearly for a smallholder farmer in ${targetLang} using short bullet points. Distinguish verified market reports from general estimates and avoid promising future prices.`,
        config: {
          tools: [{googleSearch: {}}],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .map((chunk: any) => {
          if (chunk.web?.uri) {
            return {
              title: chunk.web.title || 'Market Source',
              uri: chunk.web.uri,
              kind: 'web',
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
    } catch (error: any) {
      console.error('Mandi grounding error:', error);
      return res.status(500).json({
        error: error?.message || 'Unable to fetch live mandi grounding right now.',
      });
    }
  });

  // Deep-Thinking Farming & Market Advisor (gemini-4-hydrogen with ThinkingLevel.HIGH)
  app.post('/api/ai/advisor', async (req, res) => {
    try {
      const {question, cropContext, weatherContext, locationName, language = 'en'} =
        req.body ?? {};
      if (!question || typeof question !== 'string') {
        return res.status(400).json({error: 'Please enter a farming or market question.'});
      }

      const ai = getAiClient();
      const targetLang = LANGUAGE_NAMES[language] ?? 'English';

      const prompt = [
        `Farmer Location: ${locationName || 'Bengaluru Rural, Karnataka, India'}`,
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
          systemInstruction: `You are Krishi Mitra, a trusted Indian agricultural advisor speaking to smallholder farmers. Respond strictly in ${targetLang}. Use short, clear paragraphs and practical bullet points. Never make medical claims or guarantee future mandi prices; always advise weighing transport and grading costs before choosing a distant mandi.`,
        },
      });

      return res.json({
        answer: response.text || '',
        updatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Advisor error:', error);
      return res.status(500).json({
        error: error?.message || 'Unable to get advisor response right now.',
      });
    }
  });

  // Low-latency summary helper (gemini-3.1-flash-lite)
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
    } catch (error: any) {
      console.error('Quick summary error:', error);
      return res.status(500).json({
        error: error?.message || 'Unable to generate quick summary.',
      });
    }
  });

  // Text-to-Speech Audio Readout (gemini-3.8-flash-tts)
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const {text, language = 'en'} = req.body ?? {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({error: 'Text is required for audio readout.'});
      }

      const ai = getAiClient();
      const targetLang = LANGUAGE_NAMES[language] ?? 'English';
      const trimmed = text.slice(0, 1400);

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: trimmed,
                speechMetadata: {
                  style: `Clear, warm, unhurried agricultural advisor speaking naturally in ${targetLang}`,
                } as any,
              },
            ],
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
    } catch (error: any) {
      console.error('TTS error:', error);
      return res.status(500).json({
        error: error?.message || 'Unable to generate speech audio right now.',
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
    console.log(`Krishi Mitra server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
