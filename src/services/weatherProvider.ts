import {LocationOption, WeatherAlertPrefs, WeatherSnapshot} from '../types/krishi';

const WEATHER_CACHE_KEY = 'km_weather_cache_v2';

export interface WeatherDataProvider {
  getForecast(
    location: LocationOption,
    alertPrefs: WeatherAlertPrefs,
    options?: {taluk?: string; savedCropIds?: string[]; forceRefresh?: boolean},
  ): Promise<WeatherSnapshot>;
}

class BackendWeatherProvider implements WeatherDataProvider {
  private readCache(locationId: string): WeatherSnapshot | null {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, {savedAt: number; snapshot: WeatherSnapshot}>;
      const entry = parsed[locationId];
      if (!entry) return null;
      // Allow up to 18 hours as offline cache, clearly marked stale
      if (Date.now() - entry.savedAt > 18 * 60 * 60 * 1000) return null;
      return entry.snapshot;
    } catch {
      return null;
    }
  }

  private writeCache(locationId: string, snapshot: WeatherSnapshot): void {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      const parsed: Record<string, {savedAt: number; snapshot: WeatherSnapshot}> = raw
        ? JSON.parse(raw)
        : {};
      parsed[locationId] = {savedAt: Date.now(), snapshot};
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore storage quota errors
    }
  }

  async getForecast(
    location: LocationOption,
    alertPrefs: WeatherAlertPrefs,
    options: {taluk?: string; savedCropIds?: string[]; forceRefresh?: boolean} = {},
  ): Promise<WeatherSnapshot> {
    const qs = new URLSearchParams({
      locationId: location.id,
      prefRain: alertPrefs.rain ? '1' : '0',
      prefHeavyRain: alertPrefs.heavyRain ? '1' : '0',
      prefTemp: alertPrefs.temperature ? '1' : '0',
      prefWind: alertPrefs.wind ? '1' : '0',
      prefDaily: alertPrefs.dailyForecast ? '1' : '0',
    });
    if (options.taluk) qs.set('taluk', options.taluk);
    if (options.savedCropIds && options.savedCropIds.length > 0) {
      qs.set('crops', options.savedCropIds.join(','));
    }
    if (options.forceRefresh) qs.set('refresh', '1');

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 9000);
      const res = await fetch(`/api/weather/forecast?${qs.toString()}`, {
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      const data = (await res.json()) as WeatherSnapshot & {error?: string};
      if (!res.ok) {
        throw new Error(data.error || `Weather service HTTP ${res.status}`);
      }

      this.writeCache(location.id, data);
      return data;
    } catch (err: unknown) {
      // Never silently fabricate fake weather! Use last verified browser cache with explicit stale flag if available
      const cached = this.readCache(location.id);
      if (cached) {
        return {
          ...cached,
          source: 'cached',
          officialProvider: 'cached_open_meteo',
          sourceLabel: `${cached.sourceLabel.replace(/\s*\(Cached\)$/i, '')} (Cached)`,
          isStale: true,
          staleReason:
            'Unable to reach live weather server right now; showing your last verified forecast.',
        };
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Live weather forecast could not be loaded. Check your connection and retry.';
      throw new Error(message);
    }
  }
}

export const weatherProvider: WeatherDataProvider = new BackendWeatherProvider();
