import {GoogleGenAI, ThinkingLevel} from '@google/genai';
import {CROP_CATALOG_META} from '../data/cropCatalogMeta.ts';
import {findLocationById} from '../data/locations.ts';
import type {DailyBriefingResponse, LanguageCode} from '../types/krishi.ts';
import {marketService} from './marketService.ts';
import {getDynamicWeatherForecast} from './weatherService.ts';

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
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
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
    marketStatus.lastSyncAt || 'none',
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
      // If the farmer has saved crops and none are freshly grounded yet, trigger live Gemini Search grounding
      const marketFeedPromise =
        savedCropIds.length > 0
          ? marketService.fetchGroundedMarketPrices({
              cropIds: savedCropIds.slice(0, 6),
              state,
              district,
              preferredMandi,
              forceRefresh: false,
            })
          : Promise.resolve(
              marketService.getMarketFeed({
                state,
                district,
                preferredMandi,
              }),
            );

      const [marketFeed, weatherResult] = await Promise.all([
        withTimeout(marketFeedPromise, 12000, 'Market feed lookup').catch(() =>
          marketService.getMarketFeed({
            state,
            district,
            preferredMandi,
          }),
        ),
        withTimeout(
          getDynamicWeatherForecast({
            locationId: loc.id,
            state,
            district,
            taluk,
            savedCropIds,
          }),
          14000,
          'Weather lookup',
        ).catch(() => null),
      ]);

      const savedCropsPayload = savedCropIds.map((cropId) => {
        const meta = CROP_CATALOG_META.find((m) => m.id === cropId);
        const obs = marketFeed.observations[cropId];
        return {
          crop: meta?.name || cropId,
          category: meta?.category || 'vegetable',
          verifiedOnline: Boolean(obs),
          modalPricePerKg: obs ? obs.modalPriceKg : null,
          modalPricePerQuintal: obs ? obs.modalPriceQuintal : null,
          changePercent: obs?.priceChangePercent ?? null,
          market: obs?.market || null,
          observationDate: obs?.arrivalDate || null,
          sourceName: obs?.sourceName || null,
        };
      });

      const verifiedHighlights = Object.values(marketFeed.observations)
        .slice(0, 4)
        .map((o) => ({
          crop: o.commodity,
          modalPricePerKg: o.modalPriceKg,
          modalPricePerQuintal: o.modalPriceQuintal,
          market: o.market,
          observationDate: o.arrivalDate,
          sourceName: o.sourceName,
        }));

      const compactPayload = {
        greeting: `${getTimeGreeting()}, ${cleanName}`,
        farmerName: cleanName,
        location: {state, district, taluk, preferredMandi},
        marketDataStatus: {
          status: marketFeed.status.sourceStatus,
          observationDate: marketFeed.status.observationDate,
          verifiedCropCount: verifiedHighlights.length,
          note:
            verifiedHighlights.length > 0
              ? 'Prices below were retrieved online via Gemini Google Search grounding with cited mandi sources.'
              : 'Latest verified market price is currently unavailable for the tracked crops. State this honestly without inventing any price numbers.',
        },
        farmerSavedCropsCount: savedCropsPayload.length,
        farmerSavedCrops: savedCropsPayload,
        verifiedRegionalHighlights: verifiedHighlights,
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
                sourceName: a.sourceName,
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
Use ONLY the supplied verified market, weather, and advisory facts. Never invent prices, dates, or weather numbers.
If verified online mandi prices exist for the farmer's saved crops, quote them with their market name and observation date.
If a crop has verifiedOnline: false or no verified prices are available, explicitly say that the latest verified market price is currently unavailable without making up numbers.
If 0 crops are saved, briefly encourage adding crops from the Marketplace.
Distinguish official weather alerts from general guidance and include one clear field recommendation.
Keep sentences short, calm, and spoken naturally. No markdown, no bullet symbols, no emojis.`;

      const userPrompt = `Generate today's spoken farmer briefing strictly in ${targetLang} from this verified JSON data:\n${JSON.stringify(compactPayload)}`;

      let briefingText = '';
      let audioError: string | null = null;

      try {
        const textRes = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: userPrompt,
            config: {
              thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
              systemInstruction,
            },
          }),
          10000,
          'Briefing text (gemini-4-hydrogen)',
        );
        briefingText = (textRes.text || '').trim().replace(/\s+/g, ' ');
      } catch {
        try {
          const fallbackRes = await withTimeout(
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: userPrompt,
              config: {
                systemInstruction,
              },
            }),
            10000,
            'Briefing text (gemini-3.1-flash-lite)',
          );
          briefingText = (fallbackRes.text || '').trim().replace(/\s+/g, ' ');
        } catch {
          const weatherParts: string[] = [];
          if (weatherResult) {
            if (weatherResult.currentTemperature !== null) {
              weatherParts.push(`currently ${weatherResult.currentTemperature} degrees Celsius`);
            }
            if (weatherResult.condition) {
              weatherParts.push(`with ${weatherResult.condition.toLowerCase()} conditions`);
            }
            if (weatherResult.rainProbability !== null) {
              weatherParts.push(`and a ${weatherResult.rainProbability} percent chance of rain`);
            }
          }
          const weatherSentence =
            weatherResult && weatherParts.length > 0
              ? `In ${district}, it is ${weatherParts.join(' ')}. ${weatherResult.advisories[0]?.recommendation || ''}`
              : `Live weather data for ${district} is temporarily unavailable right now.`;
          const verifiedSaved = savedCropsPayload.filter((c) => c.verifiedOnline && c.modalPricePerKg);
          const marketSentence =
            verifiedSaved.length > 0
              ? `Latest verified mandi rates show ${verifiedSaved
                  .slice(0, 2)
                  .map((c) => `${c.crop} at ${c.modalPricePerKg} rupees per kg in ${c.market}`)
                  .join(', ')}.`
              : savedCropsPayload.length > 0
                ? 'Latest verified market prices for your saved crops are currently unavailable.'
                : 'Add your vegetables and fruits in the Marketplace to receive live crop-specific mandi updates.';

          briefingText = `${getTimeGreeting()}, ${cleanName}. ${weatherSentence} ${marketSentence}`.replace(
            /\s+/g,
            ' ',
          );
          audioError =
            'Gemini AI is momentarily busy; briefing prepared from verified live weather and grounded records.';
        }
      }

      if (!briefingText) {
        throw new Error('Briefing generator returned empty text.');
      }

      let audioBase64: string | null = null;
      let mimeType: string | null = null;

      try {
        const ttsRes = await withTimeout(
          ai.models.generateContent({
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
          }),
          8000,
          'Briefing TTS',
        );

        const audioPart = ttsRes.candidates?.[0]?.content?.parts?.[0];
        if (audioPart?.inlineData?.data) {
          audioBase64 = audioPart.inlineData.data;
          mimeType = audioPart.inlineData.mimeType || 'audio/wav';
        } else if (!audioError) {
          audioError = 'Cloud voice synthesis unavailable; playing with browser voice.';
        }
      } catch {
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
