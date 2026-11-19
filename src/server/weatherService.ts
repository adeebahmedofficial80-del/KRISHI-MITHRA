import {GoogleGenAI} from '@google/genai';
import fs from 'fs';
import path from 'path';
import {findLocationById} from '../data/locations.ts';
import type {
  FarmAdvisory,
  ForecastDay,
  GroundedSourceRef,
  WeatherAlertItem,
  WeatherAlertPrefs,
  WeatherSnapshot,
} from '../types/krishi.ts';

const CACHE_DIR = path.resolve(process.cwd(), '.krishi-cache');
const WEATHER_CACHE_FILE = path.join(CACHE_DIR, 'gemini-weather-cache.json');
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes fresh cache per location
const GEMINI_TIMEOUT_MS = 28 * 1000;

export const GEMINI_WEATHER_SYSTEM_INSTRUCTION =
  "You are KRISHI-MITHRA's weather intelligence assistant. Using Google Search grounding, retrieve the latest available weather conditions and seven-day forecast for the farmer's exact saved location in India. Prefer official IMD information and reliable weather sources. Return today's temperature, minimum and maximum temperatures, weather conditions, rainfall probability, humidity, wind conditions and relevant warnings. Also provide the next seven days' dates, minimum and maximum temperatures, weather conditions and rainfall probabilities. Include source URLs, observation dates and retrieval time. Never invent missing values or present an outdated observation as current. Clearly identify unavailable information.";

interface CachedWeatherRecord {
  savedAtMs: number;
  baseSnapshot: WeatherSnapshot;
}

interface PersistedWeatherCache {
  entries: Record<string, CachedWeatherRecord>;
}

const memoryWeatherCache = new Map<string, CachedWeatherRecord>();
const inFlightWeatherRequests = new Map<string, Promise<WeatherSnapshot>>();

interface GroundingChunkLike {
  web?: {uri?: string; title?: string};
}

interface RawGeminiWarning {
  title?: string;
  severity?: string;
  summary?: string;
  action?: string;
  sourceName?: string;
  sourceUrl?: string;
  issuedAt?: string;
}

interface RawGeminiForecastDay {
  date?: string;
  weekday?: string;
  minTempC?: number | string | null;
  maxTempC?: number | string | null;
  condition?: string | null;
  rainProbabilityPercent?: number | string | null;
  expectedRainfallMm?: number | string | null;
  humidityPercent?: number | string | null;
  windSpeedKmh?: number | string | null;
  warning?: string | null;
}

interface RawGeminiWeatherPayload {
  locationResolved?: string | null;
  observationDate?: string | null;
  forecastPublishedAt?: string | null;
  primarySourceName?: string | null;
  primarySourceUrl?: string | null;
  current?: {
    temperatureC?: number | string | null;
    feelsLikeC?: number | string | null;
    condition?: string | null;
    humidityPercent?: number | string | null;
    windSpeedKmh?: number | string | null;
    windDirection?: string | null;
    windSummary?: string | null;
    rainProbabilityPercent?: number | string | null;
    sunrise?: string | null;
    sunset?: string | null;
  } | null;
  todayForecast?: {
    minTempC?: number | string | null;
    maxTempC?: number | string | null;
    condition?: string | null;
    rainProbabilityPercent?: number | string | null;
    expectedRainfallMm?: number | string | null;
    summary?: string | null;
  } | null;
  warnings?: RawGeminiWarning[] | null;
  sevenDayForecast?: RawGeminiForecastDay[] | null;
  unavailableFields?: string[] | null;
  sources?: Array<{title?: string; url?: string}> | null;
}

function loadDiskWeatherCache(): void {
  try {
    if (!fs.existsSync(WEATHER_CACHE_FILE)) return;
    const raw = fs.readFileSync(WEATHER_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedWeatherCache;
    if (parsed && parsed.entries && typeof parsed.entries === 'object') {
      for (const [key, entry] of Object.entries(parsed.entries)) {
        if (entry && typeof entry.savedAtMs === 'number' && entry.baseSnapshot) {
          memoryWeatherCache.set(key, entry);
        }
      }
    }
  } catch {
    // Ignore unreadable cache file
  }
}

function saveDiskWeatherCache(): void {
  try {
    fs.mkdirSync(CACHE_DIR, {recursive: true});
    const entries: Record<string, CachedWeatherRecord> = {};
    const sortedEntries = Array.from(memoryWeatherCache.entries())
      .sort((a, b) => b[1].savedAtMs - a[1].savedAtMs)
      .slice(0, 80);
    for (const [k, v] of sortedEntries) {
      entries[k] = v;
    }
    fs.writeFileSync(WEATHER_CACHE_FILE, JSON.stringify({entries}, null, 2), 'utf-8');
  } catch {
    // Ignore read-only runtime disk write issues
  }
}

loadDiskWeatherCache();

function getAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
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

function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit')
  );
}

function formatIstTimestamp(date: Date): string {
  return `${date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })} IST`;
}

function formatIstDateTime(date: Date): string {
  const datePart = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  return `${datePart}, ${formatIstTimestamp(date)}`;
}

interface IstDaySlot {
  date: string; // YYYY-MM-DD
  weekday: string; // Thu
  shortDate: string; // 19 Nov
  dayLabel: string; // Today (19 Nov) or Fri 20 Nov
}

function buildIstSevenDaySlots(now = new Date()): IstDaySlot[] {
  const todayIstIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const [y, m, d] = todayIstIso.split('-').map(Number);
  const baseUtc = new Date(Date.UTC(y, m - 1, d, 6, 30, 0));

  const slots: IstDaySlot[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(baseUtc.getTime() + i * 24 * 60 * 60 * 1000);
    const iso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dt);
    const weekday = dt.toLocaleDateString('en-IN', {
      weekday: 'short',
      timeZone: 'Asia/Kolkata',
    });
    const shortDate = dt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });
    slots.push({
      date: iso,
      weekday,
      shortDate,
      dayLabel: i === 0 ? `Today (${shortDate})` : `${weekday} ${shortDate}`,
    });
  }
  return slots;
}

function parseBoundedNumber(
  val: unknown,
  min: number,
  max: number,
  decimals = 0,
): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return null;
  const rawStr = typeof val === 'number' ? String(val) : String(val).trim();
  if (!rawStr || /^(null|n\/a|na|unknown|unavailable|none|-+)$/i.test(rawStr)) return null;
  const match = rawStr.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return decimals > 0 ? Number(num.toFixed(decimals)) : Math.round(num);
}

function cleanString(val: unknown, maxLen = 120): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim().replace(/\s+/g, ' ');
  if (!trimmed || /^(null|n\/a|na|unknown|unavailable|none)$/i.test(trimmed)) return null;
  return trimmed.slice(0, maxLen);
}

function extractJsonObject(rawText: string): RawGeminiWeatherPayload | null {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const candidates: string[] = [cleaned];
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as RawGeminiWeatherPayload;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

function extractGroundingSources(
  response: unknown,
  payloadSources?: Array<{title?: string; url?: string}> | null,
): GroundedSourceRef[] {
  const resObj = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: GroundingChunkLike[];
      };
    }>;
  };
  const chunks = resObj?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const refs: GroundedSourceRef[] = [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri?.trim();
    if (!uri || !/^https?:\/\//i.test(uri) || seen.has(uri)) continue;
    seen.add(uri);
    let fallbackHost = 'Weather Source';
    try {
      fallbackHost = new URL(uri).hostname;
    } catch {
      // ignore
    }
    refs.push({
      title: chunk?.web?.title?.trim() || fallbackHost,
      url: uri,
    });
  }

  if (Array.isArray(payloadSources)) {
    for (const s of payloadSources) {
      const uri = typeof s?.url === 'string' ? s.url.trim() : '';
      if (!uri || !/^https?:\/\//i.test(uri) || seen.has(uri)) continue;
      seen.add(uri);
      let fallbackHost = 'Weather Source';
      try {
        fallbackHost = new URL(uri).hostname;
      } catch {
        // ignore
      }
      refs.push({
        title: cleanString(s?.title, 100) || fallbackHost,
        url: uri,
      });
    }
  }

  return refs.slice(0, 8);
}

function buildAlerts(
  forecast: ForecastDay[],
  currentWind: number | null,
  currentHumidity: number | null,
  groundedWarnings: RawGeminiWarning[],
  groundedSources: GroundedSourceRef[],
  prefs?: WeatherAlertPrefs,
): WeatherAlertItem[] {
  const items: WeatherAlertItem[] = [];
  const allowRain = prefs?.rain ?? true;
  const allowHeavyRain = prefs?.heavyRain ?? true;
  const allowHeat = prefs?.temperature ?? true;
  const allowWind = prefs?.wind ?? true;

  groundedWarnings.slice(0, 4).forEach((w, idx) => {
    const title = cleanString(w.title, 110);
    const summary = cleanString(w.summary, 280);
    if (!title || !summary) return;
    const rawSev = (w.severity || '').toLowerCase();
    const severity: 'Low' | 'Moderate' | 'High' =
      rawSev.includes('high') || rawSev.includes('red') || rawSev.includes('orange')
        ? 'High'
        : rawSev.includes('mod') || rawSev.includes('yellow')
          ? 'Moderate'
          : 'Low';
    const textLower = `${title} ${summary}`.toLowerCase();
    const type: WeatherAlertItem['type'] = textLower.includes('heat')
      ? 'heat'
      : textLower.includes('wind') || textLower.includes('squall') || textLower.includes('gust')
        ? 'wind'
        : textLower.includes('heavy') || textLower.includes('storm') || textLower.includes('thunder')
          ? 'heavy_rain'
          : textLower.includes('humid')
            ? 'humidity'
            : 'rain';
    const srcName = cleanString(w.sourceName, 90) || groundedSources[0]?.title || 'IMD / Weather Bulletin';
    const isImd = srcName.toLowerCase().includes('imd') || srcName.toLowerCase().includes('mausam');
    const srcUrl =
      (typeof w.sourceUrl === 'string' && /^https?:\/\//i.test(w.sourceUrl.trim())
        ? w.sourceUrl.trim()
        : null) || groundedSources[0]?.url;

    items.push({
      id: `grounded-warn-${idx + 1}`,
      type,
      severity,
      title,
      summary,
      action:
        cleanString(w.action, 200) ||
        'Monitor local IMD district bulletins and protect field operations and harvested produce.',
      sourceType: isImd ? 'official_imd' : 'official_grounded',
      sourceName: srcName,
      sourceUrl: srcUrl,
      issuedAt: cleanString(w.issuedAt, 60) || undefined,
    });
  });

  const next3 = forecast.slice(0, 3);
  const rainDays = next3.filter((d) => d.rainProbability !== null && d.rainProbability >= 50);
  const heavyRainDays = next3.filter(
    (d) =>
      (d.rainfallMm !== null && d.rainfallMm >= 15) ||
      (d.rainProbability !== null && d.rainProbability >= 75),
  );
  const heatDays = next3.filter((d) => d.maxTemp !== null && d.maxTemp >= 36);
  const highWindDay = next3.find(
    (d) => d.windSpeedMax !== null && d.windSpeedMax !== undefined && d.windSpeedMax >= 24,
  );

  if (allowHeavyRain && heavyRainDays.length > 0 && !items.some((a) => a.type === 'heavy_rain')) {
    const peak = heavyRainDays[0];
    items.push({
      id: 'derived-heavy-rain',
      type: 'heavy_rain',
      severity: 'High',
      title: `High Rain Risk Expected (${peak.dayLabel})`,
      summary: `Forecast indicates ${peak.rainProbability ?? 'elevated'}% rain probability${peak.rainfallMm !== null ? ` (${peak.rainfallMm} mm)` : ''} on ${peak.dayLabel}.`,
      action:
        'Open field drainage channels, postpone foliar sprays, and move harvested produce under dry cover.',
      sourceType: 'weather_derived',
      sourceName: 'Derived from Gemini-grounded 7-day forecast',
    });
  } else if (allowRain && rainDays.length > 0 && !items.some((a) => a.type === 'rain')) {
    const firstRain = rainDays[0];
    items.push({
      id: 'derived-rain',
      type: 'rain',
      severity: 'Moderate',
      title: `Rain Showers Likely (${firstRain.dayLabel})`,
      summary: `${firstRain.rainProbability}% chance of rain forecast on ${firstRain.dayLabel}.`,
      action:
        'Complete morning harvests early and avoid spraying contact fungicides just before showers.',
      sourceType: 'weather_derived',
      sourceName: 'Derived from Gemini-grounded 7-day forecast',
    });
  }

  if (allowHeat && heatDays.length > 0 && !items.some((a) => a.type === 'heat')) {
    const hottest = heatDays[0];
    items.push({
      id: 'derived-heat',
      type: 'heat',
      severity: (hottest.maxTemp ?? 0) >= 40 ? 'High' : 'Moderate',
      title: `High Daytime Heat (${hottest.maxTemp}°C on ${hottest.dayLabel})`,
      summary: `Forecast daytime highs reach ${hottest.maxTemp}°C around ${hottest.dayLabel}.`,
      action:
        'Schedule irrigation early morning or late evening and shade freshly harvested produce before mandi dispatch.',
      sourceType: 'weather_derived',
      sourceName: 'Derived from Gemini-grounded 7-day forecast',
    });
  }

  if (allowWind && ((currentWind !== null && currentWind >= 20) || highWindDay)) {
    const speed = Math.max(currentWind ?? 0, highWindDay?.windSpeedMax ?? 0);
    if (!items.some((a) => a.type === 'wind')) {
      items.push({
        id: 'derived-wind',
        type: 'wind',
        severity: speed >= 30 ? 'High' : 'Moderate',
        title: `Breezy Spraying Conditions (${speed} km/h)`,
        summary: `Forecast wind speeds near ${speed} km/h increase spray drift risk.`,
        action:
          'Prefer calm dawn hours for spraying and verify staking on tall vegetable and banana crops.',
        sourceType: 'weather_derived',
        sourceName: 'Derived from Gemini-grounded 7-day forecast',
      });
    }
  }

  if (currentHumidity !== null && currentHumidity >= 82 && !items.some((a) => a.type === 'humidity')) {
    items.push({
      id: 'derived-humidity',
      type: 'humidity',
      severity: 'Low',
      title: `High Relative Humidity (${currentHumidity}%)`,
      summary: `Elevated humidity (${currentHumidity}%) favors fungal leaf-spot and blight in dense canopies.`,
      action: 'Scout lower foliage early morning and keep harvested crates well-ventilated.',
      sourceType: 'weather_derived',
      sourceName: 'Derived from Gemini-grounded weather observation',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'derived-clear',
      type: 'rain',
      severity: 'Low',
      title: 'No Severe Weather Warnings Reported',
      summary:
        'Current grounded forecast shows no major rainfall, storm, or extreme heat warnings for the next 72 hours.',
      action: 'Favorable window for routine harvesting, grading, and timely mandi transport.',
      sourceType: 'weather_derived',
      sourceName: 'Derived from Gemini-grounded 7-day forecast',
    });
  }

  return items;
}

function buildCropSensitiveAdvisories(
  forecast: ForecastDay[],
  currentHumidity: number | null,
  currentWind: number | null,
  savedCropIds: string[],
): FarmAdvisory[] {
  const advisories: FarmAdvisory[] = [];
  const today = forecast[0];
  const next3 = forecast.slice(0, 3);
  const rainLikely = next3.some(
    (d) =>
      (d.rainProbability !== null && d.rainProbability >= 50) ||
      (d.rainfallMm !== null && d.rainfallMm >= 5),
  );
  const peakMax = next3.reduce(
    (max, d) => (d.maxTemp !== null ? Math.max(max, d.maxTemp) : max),
    -Infinity,
  );
  const highHeat = Number.isFinite(peakMax) && peakMax >= 34;

  if (rainLikely) {
    const rainDay = next3.find(
      (d) =>
        (d.rainProbability !== null && d.rainProbability >= 50) ||
        (d.rainfallMm !== null && d.rainfallMm >= 5),
    );
    advisories.push({
      id: 'adv-rain-harvest',
      condition: `Rain forecast (${rainDay?.rainProbability ?? '—'}% on ${rainDay?.dayLabel || 'upcoming days'})`,
      priority: 'High',
      recommendation: 'Avoid foliar spraying before rain; harvest ripe produce early',
      reason:
        'Expected rainfall can wash away foliar sprays and increase moisture-related spoilage during mandi transit.',
      timeWindow: 'Next 24–48 hours',
      sourceType: 'weather_derived',
      sourceName: 'Gemini-grounded forecast guidance',
    });
  } else {
    advisories.push({
      id: 'adv-dry-window',
      condition:
        today?.rainProbability !== null && today?.rainProbability !== undefined
          ? `Low rain probability (${today.rainProbability}% today)`
          : 'No heavy rain reported today',
      priority: 'Low',
      recommendation: 'Good window for morning harvest, grading, and field care',
      reason:
        'Lower rainfall risk helps keep harvested produce dry and improves shelf-life during mandi dispatch.',
      timeWindow: 'Today & Tomorrow',
      sourceType: 'weather_derived',
      sourceName: 'Gemini-grounded forecast guidance',
    });
  }

  if (highHeat) {
    advisories.push({
      id: 'adv-heat-irrigation',
      condition: `Peak daytime temperature around ${peakMax}°C`,
      priority: 'Moderate',
      recommendation: 'Irrigate early morning or after 5 PM and shade harvested crates',
      reason:
        'Midday heat increases moisture loss and wilting in leafy greens and tender vegetables.',
      timeWindow: 'Before 9 AM / After 5 PM',
      sourceType: 'weather_derived',
      sourceName: 'Gemini-grounded forecast guidance',
    });
  }

  if (currentWind !== null && currentWind >= 18) {
    advisories.push({
      id: 'adv-wind-spray',
      condition: `Wind speed around ${currentWind} km/h`,
      priority: 'Moderate',
      recommendation: 'Limit spraying to calm sunrise hours to prevent drift',
      reason:
        'Wind above 18 km/h causes uneven droplet coverage and wastes crop protection inputs.',
      timeWindow: '6:00 AM – 8:30 AM',
      sourceType: 'weather_derived',
      sourceName: 'Gemini-grounded forecast guidance',
    });
  }

  const savedSet = new Set(savedCropIds);

  const highHumidityCrops = [
    'tomato',
    'potato',
    'onion',
    'grapes',
    'green-chilli',
    'capsicum',
  ].filter((id) => savedSet.has(id));
  if (
    highHumidityCrops.length > 0 &&
    ((currentHumidity !== null && currentHumidity >= 75) || rainLikely)
  ) {
    advisories.push({
      id: 'crop-adv-blight',
      condition: `${currentHumidity !== null ? `Humidity ${currentHumidity}%` : 'Moist forecast'} with moisture risk`,
      priority: 'High',
      recommendation:
        'Inspect saved solanaceous/bulb crops for early leaf blight and ensure quick crate drying',
      reason:
        'Humid and damp periods raise fungal pressure on tomato, onion, potato, chilli, capsicum, and grape crops.',
      timeWindow: 'Next 48 hours',
      sourceType: 'crop_suggestion',
      sourceName: 'Crop-Sensitive Guidance (Saved Crops)',
      relatedCropIds: highHumidityCrops,
    });
  }

  const heatSensitiveCrops = [
    'spinach',
    'coriander',
    'cabbage',
    'cauliflower',
    'carrot',
    'beans',
    'strawberry',
    'green-peas',
  ].filter((id) => savedSet.has(id));
  if (heatSensitiveCrops.length > 0 && highHeat) {
    advisories.push({
      id: 'crop-adv-heat',
      condition: `Warm daytime highs near ${peakMax}°C`,
      priority: 'Moderate',
      recommendation: 'Harvest leafy & cool-season crops before 8 AM and mist lightly in shade',
      reason:
        'Warm afternoon temperatures rapidly reduce freshness weight and visual grade at auction.',
      timeWindow: 'Early Morning',
      sourceType: 'crop_suggestion',
      sourceName: 'Crop-Sensitive Guidance (Saved Crops)',
      relatedCropIds: heatSensitiveCrops,
    });
  }

  const vineAndOrchardCrops = [
    'banana',
    'papaya',
    'mango',
    'bottle-gourd',
    'bitter-gourd',
    'ridge-gourd',
    'ladies-finger',
    'drumstick',
  ].filter((id) => savedSet.has(id));
  if (
    vineAndOrchardCrops.length > 0 &&
    ((currentWind !== null && currentWind >= 16) || rainLikely)
  ) {
    advisories.push({
      id: 'crop-adv-support',
      condition:
        currentWind !== null ? `Wind ${currentWind} km/h / shower forecast` : 'Shower forecast',
      priority: 'Moderate',
      recommendation:
        'Check propping for banana/papaya and clear drainage around vine and orchard beds',
      reason:
        'Standing water and gusts can lodge heavy bunches and damage trellis vines.',
      timeWindow: 'Today',
      sourceType: 'crop_suggestion',
      sourceName: 'Crop-Sensitive Guidance (Saved Crops)',
      relatedCropIds: vineAndOrchardCrops,
    });
  }

  return advisories.slice(0, 6);
}

async function fetchGeminiGroundedWeather(params: {
  locationId: string;
  state: string;
  district: string;
  taluk?: string;
}): Promise<WeatherSnapshot> {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const now = new Date();
  const retrievedAtIso = now.toISOString();
  const updatedAtLabel = formatIstTimestamp(now);
  const slots = buildIstSevenDaySlots(now);
  const locationParts = [params.taluk?.trim(), params.district.trim(), params.state.trim()].filter(
    Boolean,
  );
  const exactLocationLabel = locationParts.join(', ');
  const dateScheduleText = slots
    .map(
      (s, idx) =>
        `Day ${idx + 1}: ${s.date} (${s.weekday}, ${s.shortDate})${idx === 0 ? ' [TODAY]' : ''}`,
    )
    .join('\n');

  const userPrompt = `Retrieve the latest verified current weather conditions AND the 7-day weather forecast for this exact Indian farm location:
Location: ${exactLocationLabel}, India
Current Indian local time (IST): ${formatIstDateTime(now)}

Exact 7-day Indian calendar dates (Asia/Kolkata) to cover:
${dateScheduleText}

Requirements:
1. Search official IMD (mausam.imd.gov.in / regional meteorological centres) and reliable Indian/global weather sources (e.g., AccuWeather, Weather.com, Skymet, Timeanddate) for ${exactLocationLabel}, India.
2. Distinguish ACTUAL current observed conditions (current.temperatureC, current.condition, humidity, wind) from TODAY'S forecast (todayForecast.minTempC, todayForecast.maxTempC, todayForecast.condition, todayForecast.rainProbabilityPercent).
3. Provide all 7 forecast days using the exact YYYY-MM-DD dates listed above.
4. For any metric genuinely not found in the retrieved web sources, set it strictly to null and list its name in unavailableFields. NEVER guess or invent values.
5. Include any active IMD or severe weather warnings (rain, thunderstorm, heatwave, squall, cyclone, fog). If none are active, return an empty warnings array [].

Return ONLY valid JSON matching this exact schema (no markdown explanation outside JSON):
{
  "locationResolved": "${exactLocationLabel}, India",
  "observationDate": "Actual observation date/time string from source or null",
  "forecastPublishedAt": "Forecast publication time string from source or null",
  "primarySourceName": "e.g., India Meteorological Department (IMD) or AccuWeather",
  "primarySourceUrl": "Exact source URL or null",
  "current": {
    "temperatureC": 28,
    "feelsLikeC": 30,
    "condition": "Partly Cloudy",
    "humidityPercent": 65,
    "windSpeedKmh": 12,
    "windDirection": "NE",
    "windSummary": "12 km/h NE gentle breeze",
    "rainProbabilityPercent": 20,
    "sunrise": "6:20 AM",
    "sunset": "5:52 PM"
  },
  "todayForecast": {
    "minTempC": 19,
    "maxTempC": 29,
    "condition": "Partly Cloudy with light afternoon breeze",
    "rainProbabilityPercent": 20,
    "expectedRainfallMm": 0.5,
    "summary": "Mild morning and warm afternoon"
  },
  "warnings": [],
  "sevenDayForecast": [
    {
      "date": "${slots[0].date}",
      "weekday": "${slots[0].weekday}",
      "minTempC": 19,
      "maxTempC": 29,
      "condition": "Partly Cloudy",
      "rainProbabilityPercent": 20,
      "expectedRainfallMm": 0.5,
      "humidityPercent": 65,
      "windSpeedKmh": 14,
      "warning": null
    }
  ],
  "unavailableFields": [],
  "sources": [
    { "title": "Source Name", "url": "https://..." }
  ]
}`;

  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let response: unknown = null;
  let lastErr: unknown = null;
  const attemptErrors: string[] = [];

  for (const model of modelsToTry) {
    const maxAttempts = model === 'gemini-4-hydrogen' ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
              systemInstruction: GEMINI_WEATHER_SYSTEM_INSTRUCTION,
              tools: [{googleSearch: {}}],
            },
          }),
          GEMINI_TIMEOUT_MS,
          `Gemini weather search (${model})`,
        );
        break;
      } catch (err: unknown) {
        lastErr = err;
        const rawMsg = err instanceof Error ? err.message : String(err);
        let compactMsg = rawMsg.slice(0, 220);
        try {
          const parsed = JSON.parse(rawMsg) as {error?: {code?: number; status?: string; message?: string}};
          if (parsed?.error) {
            compactMsg = `${parsed.error.code ?? ''} ${parsed.error.status ?? ''}: ${(parsed.error.message || '').slice(0, 160)}`.trim();
          }
        } catch {
          // Keep compact raw message
        }
        attemptErrors.push(`${model}: ${compactMsg}`);
        console.warn(`[weatherService] Gemini Google Search (${model} attempt ${attempt}) failed: ${compactMsg}`);

        const isTransient503 =
          compactMsg.includes('503') || compactMsg.toLowerCase().includes('unavailable');
        if (isTransient503 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 900));
          continue;
        }
        break;
      }
    }
    if (response) break;
  }

  if (!response) {
    const combinedSummary = attemptErrors.join(' | ');
    if (isQuotaOrRateLimitError(combinedSummary) || isQuotaOrRateLimitError(lastErr)) {
      throw new Error(
        `Gemini Search grounding quota limit reached (${attemptErrors[attemptErrors.length - 1] || '429 RESOURCE_EXHAUSTED'}). Live weather cannot be retrieved right now without fabricating values.`,
      );
    }
    throw new Error(
      attemptErrors[0]
        ? `Gemini Search weather retrieval failed (${attemptErrors[0]}).`
        : 'Gemini Google Search weather retrieval failed.',
    );
  }

  const resText =
    typeof (response as {text?: unknown})?.text === 'string'
      ? ((response as {text: string}).text || '').trim()
      : '';
  const payload = extractJsonObject(resText);
  if (!payload) {
    throw new Error('Weather search returned an unreadable response format. Please retry.');
  }

  const groundedSources = extractGroundingSources(response, payload.sources);
  const rawForecast = Array.isArray(payload.sevenDayForecast) ? payload.sevenDayForecast : [];

  const byIsoDate = new Map<string, RawGeminiForecastDay>();
  for (const item of rawForecast) {
    const rawDate = cleanString(item?.date, 24);
    if (rawDate) {
      const m = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        byIsoDate.set(`${m[1]}-${m[2]}-${m[3]}`, item);
      }
    }
  }

  const forecast: ForecastDay[] = slots.map((slot, idx) => {
    const matched =
      byIsoDate.get(slot.date) ||
      (byIsoDate.size === 0 && rawForecast[idx] ? rawForecast[idx] : undefined);

    let minTemp = parseBoundedNumber(matched?.minTempC, -20, 52, 0);
    let maxTemp = parseBoundedNumber(matched?.maxTempC, -15, 56, 0);
    if (minTemp !== null && maxTemp !== null && minTemp > maxTemp) {
      const swapped = minTemp;
      minTemp = maxTemp;
      maxTemp = swapped;
    }

    return {
      date: slot.date,
      weekday: slot.weekday,
      shortDate: slot.shortDate,
      dayLabel: slot.dayLabel,
      minTemp,
      maxTemp,
      condition: cleanString(matched?.condition, 60),
      rainProbability: parseBoundedNumber(matched?.rainProbabilityPercent, 0, 100, 0),
      rainfallMm: parseBoundedNumber(matched?.expectedRainfallMm, 0, 600, 1),
      humidity: parseBoundedNumber(matched?.humidityPercent, 0, 100, 0),
      windSpeedMax: parseBoundedNumber(matched?.windSpeedKmh, 0, 220, 0),
      warning: cleanString(matched?.warning, 140),
    };
  });

  const currentTemperature = parseBoundedNumber(payload.current?.temperatureC, -20, 56, 0);
  const feelsLike = parseBoundedNumber(payload.current?.feelsLikeC, -25, 62, 0);
  const currentCondition = cleanString(payload.current?.condition, 60);
  const currentHumidity = parseBoundedNumber(payload.current?.humidityPercent, 0, 100, 0);
  const currentWindSpeed = parseBoundedNumber(payload.current?.windSpeedKmh, 0, 220, 0);
  const windDirection = cleanString(payload.current?.windDirection, 20);
  const windSummary =
    cleanString(payload.current?.windSummary, 80) ||
    (currentWindSpeed !== null
      ? `${currentWindSpeed} km/h${windDirection ? ` ${windDirection}` : ''}`
      : null);

  let todayMinTemp =
    parseBoundedNumber(payload.todayForecast?.minTempC, -20, 52, 0) ?? forecast[0]?.minTemp ?? null;
  let todayMaxTemp =
    parseBoundedNumber(payload.todayForecast?.maxTempC, -15, 56, 0) ?? forecast[0]?.maxTemp ?? null;
  if (todayMinTemp !== null && todayMaxTemp !== null && todayMinTemp > todayMaxTemp) {
    const tmp = todayMinTemp;
    todayMinTemp = todayMaxTemp;
    todayMaxTemp = tmp;
  }

  if (forecast[0]) {
    if (forecast[0].minTemp === null && todayMinTemp !== null) forecast[0].minTemp = todayMinTemp;
    if (forecast[0].maxTemp === null && todayMaxTemp !== null) forecast[0].maxTemp = todayMaxTemp;
    const todayForecastRain = parseBoundedNumber(
      payload.todayForecast?.rainProbabilityPercent,
      0,
      100,
      0,
    );
    if (forecast[0].rainProbability === null && todayForecastRain !== null) {
      forecast[0].rainProbability = todayForecastRain;
    }
    const todayForecastMm = parseBoundedNumber(
      payload.todayForecast?.expectedRainfallMm,
      0,
      600,
      1,
    );
    if (forecast[0].rainfallMm === null && todayForecastMm !== null) {
      forecast[0].rainfallMm = todayForecastMm;
    }
    if (!forecast[0].condition) {
      forecast[0].condition =
        cleanString(payload.todayForecast?.condition, 60) || currentCondition;
    }
  }

  const rainProbability =
    parseBoundedNumber(payload.current?.rainProbabilityPercent, 0, 100, 0) ??
    parseBoundedNumber(payload.todayForecast?.rainProbabilityPercent, 0, 100, 0) ??
    forecast[0]?.rainProbability ??
    null;

  const todayForecastCondition =
    cleanString(payload.todayForecast?.condition, 80) ||
    cleanString(payload.todayForecast?.summary, 80) ||
    forecast[0]?.condition ||
    null;

  const hasAnyForecastTemp = forecast.some((d) => d.minTemp !== null || d.maxTemp !== null);
  if (currentTemperature === null && !currentCondition && !hasAnyForecastTemp) {
    throw new Error(
      'Gemini Search could not verify current weather observations for this location right now.',
    );
  }

  const primarySourceName =
    cleanString(payload.primarySourceName, 90) ||
    groundedSources[0]?.title ||
    'Gemini Google Search Grounding';
  const primarySourceUrl =
    groundedSources[0]?.url ||
    (typeof payload.primarySourceUrl === 'string' &&
    /^https?:\/\//i.test(payload.primarySourceUrl.trim())
      ? payload.primarySourceUrl.trim()
      : null);

  const unavailableFields = new Set<string>(
    Array.isArray(payload.unavailableFields)
      ? payload.unavailableFields
          .map((f) => cleanString(f, 60))
          .filter((f): f is string => Boolean(f))
      : [],
  );
  if (currentTemperature === null) unavailableFields.add('Current temperature');
  if (currentHumidity === null) unavailableFields.add('Humidity');
  if (rainProbability === null) unavailableFields.add('Rain probability');
  if (currentWindSpeed === null && !windSummary) unavailableFields.add('Wind speed');

  const rawWarnings = Array.isArray(payload.warnings) ? payload.warnings : [];

  return {
    locationId: params.locationId,
    locationName: exactLocationLabel,
    state: params.state,
    district: params.district,
    taluk: params.taluk,
    currentTemperature,
    feelsLike,
    condition: currentCondition,
    todayMinTemp,
    todayMaxTemp,
    todayForecastCondition,
    humidity: currentHumidity,
    windSpeed: currentWindSpeed,
    windDirection,
    windSummary,
    rainProbability,
    sunrise: cleanString(payload.current?.sunrise, 24),
    sunset: cleanString(payload.current?.sunset, 24),
    source: 'live',
    sourceLabel: `Gemini Google Search · ${primarySourceName}`,
    officialProvider: 'gemini_google_search',
    primarySourceName,
    primarySourceUrl,
    observationDate: cleanString(payload.observationDate, 80) || formatIstDateTime(now),
    forecastPublishedAt: cleanString(payload.forecastPublishedAt, 80),
    retrievedAt: retrievedAtIso,
    isStale: false,
    quotaLimited: false,
    unavailableFields: Array.from(unavailableFields),
    observedAtIso: retrievedAtIso,
    updatedAt: updatedAtLabel,
    groundedSources,
    forecast,
    alerts: buildAlerts(
      forecast,
      currentWindSpeed,
      currentHumidity,
      rawWarnings,
      groundedSources,
    ),
    advisories: [],
  };
}

function hydrateWithFarmerContext(
  base: WeatherSnapshot,
  savedCropIds: string[],
  alertPrefs?: WeatherAlertPrefs,
): WeatherSnapshot {
  const groundedRawWarnings: RawGeminiWarning[] = base.alerts
    .filter((a) => a.sourceType === 'official_imd' || a.sourceType === 'official_grounded')
    .map((a) => ({
      title: a.title,
      severity: a.severity,
      summary: a.summary,
      action: a.action,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      issuedAt: a.issuedAt,
    }));

  return {
    ...base,
    alerts: buildAlerts(
      base.forecast,
      base.windSpeed,
      base.humidity,
      groundedRawWarnings,
      base.groundedSources,
      alertPrefs,
    ),
    advisories: buildCropSensitiveAdvisories(
      base.forecast,
      base.humidity,
      base.windSpeed,
      savedCropIds,
    ),
  };
}

export async function getDynamicWeatherForecast(params: {
  locationId: string;
  state?: string;
  district?: string;
  taluk?: string;
  savedCropIds?: string[];
  alertPrefs?: WeatherAlertPrefs;
  forceRefresh?: boolean;
}): Promise<WeatherSnapshot> {
  const loc = findLocationById(params.locationId);
  const state = (params.state || loc.state).trim();
  const district = (params.district || loc.district).trim();
  const taluk = (params.taluk || loc.taluks[0] || '').trim();
  const savedCropIds = params.savedCropIds || [];

  const cacheKey = `${state.toLowerCase()}|${district.toLowerCase()}|${taluk.toLowerCase()}`;
  const cached = memoryWeatherCache.get(cacheKey);
  const isFresh = cached && Date.now() - cached.savedAtMs < WEATHER_CACHE_TTL_MS;

  if (!params.forceRefresh && isFresh && cached) {
    return hydrateWithFarmerContext(cached.baseSnapshot, savedCropIds, params.alertPrefs);
  }

  const pending = inFlightWeatherRequests.get(cacheKey);
  if (pending) {
    const sharedBase = await pending;
    return hydrateWithFarmerContext(sharedBase, savedCropIds, params.alertPrefs);
  }

  const fetchPromise = (async (): Promise<WeatherSnapshot> => {
    try {
      const freshBase = await fetchGeminiGroundedWeather({
        locationId: loc.id,
        state,
        district,
        taluk: taluk || undefined,
      });

      memoryWeatherCache.set(cacheKey, {
        savedAtMs: Date.now(),
        baseSnapshot: freshBase,
      });
      saveDiskWeatherCache();

      return freshBase;
    } catch (err: unknown) {
      const quotaHit = isQuotaOrRateLimitError(err);
      const errMessage = err instanceof Error && err.message ? err.message : '';
      const cleanReason =
        errMessage ||
        (quotaHit
          ? 'Gemini Search grounding is temporarily rate-limited or over quota.'
          : 'Live weather retrieval via Gemini Search could not be completed.');

      if (cached) {
        return {
          ...cached.baseSnapshot,
          source: 'cached',
          officialProvider: 'cached_gemini_google_search',
          sourceLabel: `Cached Gemini Weather · ${cached.baseSnapshot.primarySourceName || 'Verified Snapshot'}`,
          isStale: true,
          quotaLimited: quotaHit,
          staleReason: `${cleanReason} Showing previous verified forecast from ${cached.baseSnapshot.observationDate || cached.baseSnapshot.updatedAt}.`,
        };
      }

      throw new Error(cleanReason);
    } finally {
      inFlightWeatherRequests.delete(cacheKey);
    }
  })();

  inFlightWeatherRequests.set(cacheKey, fetchPromise);
  const resolvedBase = await fetchPromise;
  return hydrateWithFarmerContext(resolvedBase, savedCropIds, params.alertPrefs);
}
