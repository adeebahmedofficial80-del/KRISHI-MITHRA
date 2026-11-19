import {GoogleGenAI, ThinkingLevel} from '@google/genai';
import {CROP_CATALOG_META} from '../data/cropCatalogMeta';
import {findLocationById} from '../data/locations';
import {DailyBriefingResponse, LanguageCode} from '../types/krishi';
import {marketService} from './marketService';
import {getDynamicWeatherForecast} from './weatherService';

const BRIEFING_CACHE_TTL_MS = 25 * 60 * 1000;

interface CachedBriefing {
  createdAtMs: number;
  response: DailyBriefingResponse;
}

const briefingCache = new Map<string, CachedBriefing>();
const inFlightRequests = new Map<string, Promise<DailyBriefingResponse>>();

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  kn: 'Kannada (ಕನ್ನಡ)',
  hi: 'Hindi (हिंदी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
};

function getTimeGreeting(date = new Date()): string {
  const istHour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(date),
  );
  if (istHour < 12) return 'Good morning';
  if (istHour < 17) return 'Good afternoon';
  return 'Good evening';
}

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

export interface DailyBriefingInput {
  farmerName: string;
  locationId: string;
  state?: string;
  district?: string;
  taluk?: string;
  preferredMandi?: string;
  savedCropIds: string[];
  language: LanguageCode;
  forceRefresh?: boolean;
}

export async function generatePersonalizedDailyBriefing(
  input: DailyBriefingInput,
): Promise<DailyBriefingResponse> {
  const cleanName = input.farmerName.trim().slice(0, 80) || 'Farmer';
  const loc = findLocationById(input.locationId);
  const state = input.state?.trim() || loc.state;
  const district = input.district?.trim() || loc.district;
  const taluk = input.taluk?.trim() || loc.taluks[0] || '';
  const preferredMandi = input.preferredMandi?.trim() || loc.mandis[0] || '';
  const savedCropIds = Array.from(new Set(input.savedCropIds)).slice(0, 30);
  const dateKey = new Date().toISOString().slice(0, 10);
  const marketStatus = marketService.getStatus();

  const cacheKey = [
    cleanName.toLowerCase(),
    loc.id,
    taluk.toLowerCase(),
    preferredMandi.toLowerCase(),
    savedCropIds.slice().sort().join(','),
    input.language,
    dateKey,
    marketStatus.lastSyncAt || 'ref',
  ].join('|');

  const existing = briefingCache.get(cacheKey);
  if (
    !input.forceRefresh &&
    existing &&
    Date.now() - existing.createdAtMs < BRIEFING_CACHE_TTL_MS
  ) {
    return {...existing.response, cached: true};
  }

  const pending = inFlightRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const promise = (async (): Promise<DailyBriefingResponse> => {
    try {
      const [marketFeed, weatherResult] = await Promise.all([
        Promise.resolve(
          marketService.getMarketFeed({
            state,
            district,
            preferredMandi,
          }),
        ),
        getDynamicWeatherForecast({
          locationId: loc.id,
          taluk,
          savedCropIds,
        }).catch(() => null),
      ]);

      // Build compact verified payload for Gemini
      const savedCropsPayload = savedCropIds.map((cropId) => {
        const meta = CROP_CATALOG_META.find((m) => m.id === cropId);
        const obs = marketFeed.observations[cropId];
        return {
          crop: meta?.name || cropId,
          category: meta?.category || 'vegetable',
          variety: obs?.variety || meta?.defaultVariety || 'Standard',
          modalPricePerKg: obs ? obs.modalPriceKg : meta?.referenceModalKg ?? null,
          modalPricePerQuintal: obs ? obs.modalPriceQuintal : (meta?.referenceModalKg ?? 0) * 100,
          changePercent: obs?.priceChangePercent ?? null,
          market: obs?.market || preferredMandi || 'Reference baseline',
          dataStatus: obs ? obs.sourceStatus : 'catalog_reference',
        };
      });

      const allObs = Object.values(marketFeed.observations);
      const vegMovers = allObs
        .filter((o) => {
          const meta = CROP_CATALOG_META.find((m) => m.id === o.cropId);
          return meta?.category === 'vegetable';
        })
        .sort((a, b) => Math.abs(b.priceChangePercent ?? 0) - Math.abs(a.priceChangePercent ?? 0))
        .slice(0, 3)
        .map((o) => ({
          crop: o.commodity,
          modalPricePerKg: o.modalPriceKg,
          changePercent: o.priceChangePercent,
          market: o.market,
        }));

      const fruitMovers = allObs
        .filter((o) => {
          const meta = CROP_CATALOG_META.find((m) => m.id === o.cropId);
          return meta?.category === 'fruit';
        })
        .sort((a, b) => Math.abs(b.priceChangePercent ?? 0) - Math.abs(a.priceChangePercent ?? 0))
        .slice(0, 3)
        .map((o) => ({
          crop: o.commodity,
          modalPricePerKg: o.modalPriceKg,
          changePercent: o.priceChangePercent,
          market: o.market,
        }));

      const compactPayload = {
        greeting: `${getTimeGreeting()}, ${cleanName}`,
        farmerName: cleanName,
        location: {state, district, taluk, preferredMandi},
        marketDataStatus: {
          status: marketFeed.status.sourceStatus,
          observationDate: marketFeed.status.observationDate,
          isStale: marketFeed.status.isStale,
          note:
            marketFeed.status.sourceStatus === 'catalog_reference'
              ? 'Live AGMARKNET mandi sync is not configured yet; prices shown are reference baselines, NOT today live auction prices. Explicitly mention this honestly if quoting any prices.'
              : marketFeed.status.isStale
                ? 'Market prices are from the last verified cached AGMARKNET observation.'
                : 'Live AGMARKNET mandi data verified.',
        },
        farmerSavedCropsCount: savedCropsPayload.length,
        farmerSavedCrops: savedCropsPayload,
        regionalVegetableHighlights: vegMovers,
        regionalFruitHighlights: fruitMovers,
        weather: weatherResult
          ? {
              source: weatherResult.sourceLabel,
              isStale: Boolean(weatherResult.isStale),
              currentTempC: weatherResult.currentTemperature,
              condition: weatherResult.condition,
              humidityPct: weatherResult.humidity,
              windKmh: weatherResult.windSpeed,
              rainChanceTodayPct: weatherResult.rainProbability,
              nextTwoDays: weatherResult.forecast.slice(0, 3).map((d) => ({
                day: d.dayLabel,
                minC: d.minTemp,
                maxC: d.maxTemp,
                rainChancePct: d.rainProbability,
                rainMm: d.rainfallMm,
                condition: d.condition,
              })),
              activeAlerts: weatherResult.alerts.slice(0, 2).map((a) => ({
                sourceType: a.sourceType,
                title: a.title,
                action: a.action,
              })),
              topAdvisories: weatherResult.advisories.slice(0, 2).map((a) => ({
                recommendation: a.recommendation,
                timeWindow: a.timeWindow,
              })),
            }
          : {unavailable: true, note: 'Live weather could not be retrieved right now.'},
      };

      const ai = getAiClient();
      const targetLang = LANGUAGE_NAMES[input.language] || 'English';
      const systemInstruction = `You are KRISHI-MITHRA, a warm, trustworthy agricultural companion for Indian farmers.
Speak clearly in plain, natural ${targetLang} suitable for a 35 to 55 second voice briefing (about 85 to 125 words).
Greet the farmer by name (${cleanName}) using the provided time-of-day greeting.
Use ONLY the supplied verified market, weather, and advisory facts. Never invent prices, weather numbers, or claims.
If the farmer has saved crops, highlight them first; if 0 crops are saved, briefly encourage selecting crops in the Marketplace while summarizing regional status.
If live AGMARKNET market data is not yet synced or is stale, state that honestly and briefly without claiming reference prices are live today.
Mention today's real weather, any important rain/heat/wind warning, and one concise practical field recommendation.
Keep sentences short, clear, and calm. No markdown, no bullet symbols, no emojis, no filler.`;

      const userPrompt = `Generate today's spoken farmer briefing strictly in ${targetLang} from this verified JSON data:\n${JSON.stringify(compactPayload)}`;

      let briefingText = '';
      let audioError: string | null = null;

      try {
        const textRes = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: userPrompt,
          config: {
            thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
            systemInstruction,
          },
        });
        briefingText = (textRes.text || '').trim().replace(/\s+/g, ' ');
      } catch (primaryErr: unknown) {
        console.warn(
          'Primary briefing model unavailable, attempting fallback model:',
          primaryErr instanceof Error ? primaryErr.message : primaryErr,
        );
        try {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: userPrompt,
            config: {
              systemInstruction,
            },
          });
          briefingText = (fallbackRes.text || '').trim().replace(/\s+/g, ' ');
        } catch (fallbackErr: unknown) {
          console.warn(
            'Secondary Gemini briefing model unavailable, using verified structured briefing:',
            fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
          );
          const weatherSentence = weatherResult
            ? `In ${district}, it is currently ${weatherResult.currentTemperature} degrees Celsius with ${weatherResult.condition.toLowerCase()} skies and a ${weatherResult.rainProbability} percent chance of rain. ${weatherResult.advisories[0]?.recommendation || ''}`
            : `Live weather data for ${district} is temporarily unavailable right now.`;
          const cropSentence =
            savedCropsPayload.length > 0
              ? `You are tracking ${savedCropsPayload.length} crops including ${savedCropsPayload
                  .slice(0, 3)
                  .map((c) => c.crop)
                  .join(', ')}.`
              : `You have not selected any crops yet. Visit the Marketplace to add your vegetables and fruits for personalized tracking.`;
          const marketSentence =
            marketFeed.status.sourceStatus === 'live_agmarknet'
              ? `Live AGMARKNET mandi rates are active as of ${marketFeed.status.observationDate || 'today'}.`
              : `Live AGMARKNET mandi sync is not yet configured on this server, so catalog reference prices are currently shown.`;

          briefingText = `${getTimeGreeting()}, ${cleanName}. ${weatherSentence} ${cropSentence} ${marketSentence}`.replace(
            /\s+/g,
            ' ',
          );
          audioError =
            'Gemini AI is momentarily busy; briefing prepared from verified live weather and farm data.';
        }
      }

      if (!briefingText) {
        throw new Error('Briefing generator returned empty text.');
      }

      // Generate fast single-speaker audio via gemini-3.8-flash-lite-tts
      let audioBase64: string | null = null;
      let mimeType: string | null = null;

      try {
        const ttsRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: briefingText.slice(0, 1400),
                  speechMetadata: {
                    style: 'Warm, clear, calm agricultural advisor',
                  },
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

        const audioPart = ttsRes.candidates?.[0]?.content?.parts?.[0];
        if (audioPart?.inlineData?.data) {
          audioBase64 = audioPart.inlineData.data;
          mimeType = audioPart.inlineData.mimeType || 'audio/wav';
        } else if (!audioError) {
          audioError = 'Cloud voice synthesis unavailable; playing with browser voice.';
        }
      } catch (ttsErr: unknown) {
        console.error(
          'Briefing TTS error:',
          ttsErr instanceof Error ? ttsErr.message : ttsErr,
        );
        if (!audioError) {
          audioError = 'Cloud voice synthesis unavailable right now; playing with browser voice.';
        }
      }

      const response: DailyBriefingResponse = {
        briefingText,
        audioBase64,
        mimeType,
        cached: false,
        generatedAt: new Date().toISOString(),
        audioError,
        dataSources: {
          marketStatus: marketFeed.status.sourceStatus,
          marketObservationDate: marketFeed.status.observationDate,
          weatherSource: weatherResult?.sourceLabel || 'Weather unavailable',
          weatherUpdatedAt: weatherResult?.updatedAt || null,
        },
      };

      // Cache successful text+audio responses (prune cache if > 60 entries)
      if (briefingCache.size >= 60) {
        const firstKey = briefingCache.keys().next().value;
        if (firstKey) briefingCache.delete(firstKey);
      }
      briefingCache.set(cacheKey, {
        createdAtMs: Date.now(),
        response,
      });

      return response;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}
