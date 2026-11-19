import {LocationOption, WeatherAlertPrefs, WeatherSnapshot} from '../types/krishi';

const CACHE_KEY = 'km_weather_cache_v3';
const CLIENT_TIMEOUT_MS = 38_000;

interface StoredWeatherEntry {
  savedAt: number;
  snapshot: WeatherSnapshot;
}

const inFlightClientRequests = new Map<string, Promise<WeatherSnapshot>>();

function buildLocationCacheKey(state: string, district: string, taluk?: string): string {
  return `${state.trim().toLowerCase()}|${district.trim().toLowerCase()}|${(taluk || '').trim().toLowerCase()}`;
}

function readCachedWeather(cacheKey: string): StoredWeatherEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, StoredWeatherEntry>;
    return map[cacheKey] || null;
  } catch {
    return null;
  }
}

function writeCachedWeather(cacheKey: string, snapshot: WeatherSnapshot): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const map: Record<string, StoredWeatherEntry> = raw ? JSON.parse(raw) : {};
    map[cacheKey] = {savedAt: Date.now(), snapshot};
    const keys = Object.keys(map);
    if (keys.length > 12) {
      keys
        .sort((a, b) => (map[a]?.savedAt || 0) - (map[b]?.savedAt || 0))
        .slice(0, keys.length - 12)
        .forEach((oldKey) => delete map[oldKey]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export interface WeatherFetchOptions {
  state?: string;
  district?: string;
  taluk?: string;
  savedCropIds?: string[];
  forceRefresh?: boolean;
}

export interface WeatherProvider {
  getForecast(
    location: LocationOption,
    prefs?: WeatherAlertPrefs,
    options?: WeatherFetchOptions,
  ): Promise<WeatherSnapshot>;
  getCachedForecast(
    location: LocationOption,
    options?: {state?: string; district?: string; taluk?: string},
  ): WeatherSnapshot | null;
}

export class DynamicWeatherProvider implements WeatherProvider {
  getCachedForecast(
    location: LocationOption,
    options: {state?: string; district?: string; taluk?: string} = {},
  ): WeatherSnapshot | null {
    const state = (options.state || location.state).trim();
    const district = (options.district || location.district).trim();
    const taluk = (options.taluk || location.taluks[0] || '').trim();
    const cacheKey = buildLocationCacheKey(state, district, taluk);
    return readCachedWeather(cacheKey)?.snapshot || null;
  }

  async getForecast(
    location: LocationOption,
    prefs?: WeatherAlertPrefs,
    options: WeatherFetchOptions = {},
  ): Promise<WeatherSnapshot> {
    const state = (options.state || location.state).trim();
    const district = (options.district || location.district).trim();
    const taluk = (options.taluk || location.taluks[0] || '').trim();
    const cacheKey = buildLocationCacheKey(state, district, taluk);
    const flightKey = `${cacheKey}|${options.forceRefresh ? 'refresh' : 'normal'}`;

    const existingFlight = inFlightClientRequests.get(flightKey);
    if (existingFlight) {
      return existingFlight;
    }

    const requestPromise = (async (): Promise<WeatherSnapshot> => {
      const params = new URLSearchParams({
        locationId: location.id,
        state,
        district,
      });
      if (taluk) {
        params.set('taluk', taluk);
      }
      if (options.savedCropIds && options.savedCropIds.length > 0) {
        params.set('crops', options.savedCropIds.slice(0, 30).join(','));
      }
      if (options.forceRefresh) {
        params.set('refresh', '1');
      }
      if (prefs) {
        params.set('prefRain', prefs.rain ? '1' : '0');
        params.set('prefHeavyRain', prefs.heavyRain ? '1' : '0');
        params.set('prefTemp', prefs.temperature ? '1' : '0');
        params.set('prefWind', prefs.wind ? '1' : '0');
        params.set('prefDaily', prefs.dailyForecast ? '1' : '0');
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

      try {
        const res = await fetch(`/api/weather/forecast?${params.toString()}`, {
          signal: controller.signal,
        });
        window.clearTimeout(timeout);

        const data = (await res.json().catch(() => ({}))) as WeatherSnapshot & {error?: string};
        if (!res.ok) {
          throw new Error(data.error || `Weather server returned ${res.status}`);
        }
        if (!data || !Array.isArray(data.forecast) || data.forecast.length === 0) {
          throw new Error('Weather server returned an incomplete forecast.');
        }

        writeCachedWeather(cacheKey, data);
        return data;
      } catch (err: unknown) {
        window.clearTimeout(timeout);
        const cached = readCachedWeather(cacheKey);
        const errMessage =
          err instanceof DOMException && err.name === 'AbortError'
            ? 'Weather search timed out while waiting for Gemini Search grounding.'
            : err instanceof Error && err.message
              ? err.message
              : 'Unable to fetch live weather via Gemini Search right now.';

        if (cached) {
          return {
            ...cached.snapshot,
            source: 'cached',
            officialProvider: 'cached_gemini_google_search',
            sourceLabel: `Cached Gemini Weather · ${cached.snapshot.primarySourceName || 'Previous Verified Snapshot'}`,
            isStale: true,
            staleReason: `${errMessage} Showing your last verified forecast from ${cached.snapshot.observationDate || cached.snapshot.updatedAt}.`,
          };
        }

        throw new Error(errMessage);
      } finally {
        inFlightClientRequests.delete(flightKey);
      }
    })();

    inFlightClientRequests.set(flightKey, requestPromise);
    return requestPromise;
  }
}

export const weatherProvider: WeatherProvider = new DynamicWeatherProvider();
