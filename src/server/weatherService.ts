import {findLocationById} from '../data/locations';
import {
  FarmAdvisory,
  ForecastDay,
  LocationOption,
  WeatherAlertItem,
  WeatherAlertPrefs,
  WeatherSnapshot,
} from '../types/krishi';

const WEATHER_TTL_MS = 30 * 60 * 1000; // 30 minutes fresh cache

interface CachedWeatherEntry {
  fetchedAtMs: number;
  baseSnapshot: Omit<WeatherSnapshot, 'alerts' | 'advisories'>;
  officialImdAlerts: WeatherAlertItem[];
}

const weatherCache = new Map<string, CachedWeatherEntry>();

function mapWmoToCondition(code: number): ForecastDay['condition'] {
  if (code === 0) return 'Sunny';
  if (code === 1) return 'Mostly sunny';
  if (code === 2) return 'Partly cloudy';
  if (code === 3 || code === 45 || code === 48) return 'Cloudy';
  if ((code >= 51 && code <= 61) || code === 80) return 'Light rain';
  return 'Rain showers';
}

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

function formatTimeHHMM(isoStr: string): string {
  if (!isoStr || !isoStr.includes('T')) return '6:20 AM';
  const [, timePart] = isoStr.split('T');
  const [hStr, mStr] = timePart.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

async function fetchOfficialImdWarnings(location: LocationOption): Promise<WeatherAlertItem[]> {
  const imdBaseUrl = (process.env.IMD_API_BASE_URL || '').trim();
  const imdApiKey = (process.env.IMD_API_KEY || '').trim();
  if (!imdBaseUrl || !imdApiKey) {
    return [];
  }

  try {
    const url = new URL(imdBaseUrl);
    url.searchParams.set('district', location.district);
    url.searchParams.set('state', location.state);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'x-api-key': imdApiKey,
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = (await res.json()) as {
      warnings?: Array<{
        id?: string;
        type?: string;
        severity?: string;
        title?: string;
        summary?: string;
        action?: string;
        issuedAt?: string;
      }>;
    };
    if (!Array.isArray(data.warnings)) return [];

    return data.warnings.slice(0, 4).map((w, idx) => ({
      id: w.id || `imd-${idx}`,
      type:
        w.type === 'heavy_rain' || w.type === 'wind' || w.type === 'heat' || w.type === 'humidity'
          ? w.type
          : 'rain',
      severity: w.severity === 'High' || w.severity === 'Moderate' ? w.severity : 'Moderate',
      title: w.title || `IMD District Weather Warning (${location.district})`,
      summary: w.summary || 'Official India Meteorological Department weather bulletin active.',
      action: w.action || 'Follow district agricultural and IMD precautions.',
      sourceType: 'official_imd',
      issuedAt: w.issuedAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function buildDerivedWeatherAlerts(
  forecast: ForecastDay[],
  current: {windSpeed: number; humidity: number},
  prefs: WeatherAlertPrefs,
  issuedAtIso: string,
): WeatherAlertItem[] {
  const alerts: WeatherAlertItem[] = [];
  const nextThree = forecast.slice(0, 3);
  const peakRainDay = [...nextThree].sort((a, b) => b.rainfallMm - a.rainfallMm)[0];
  const peakProbDay = [...nextThree].sort((a, b) => b.rainProbability - a.rainProbability)[0];
  const peakTempDay = [...nextThree].sort((a, b) => b.maxTemp - a.maxTemp)[0];
  const peakWindDay = [...nextThree].sort((a, b) => (b.windSpeedMax ?? 0) - (a.windSpeedMax ?? 0))[0];
  const avgHumidity = Math.round(
    nextThree.reduce((acc, d) => acc + d.humidity, 0) / Math.max(1, nextThree.length),
  );

  if (prefs.heavyRain && peakRainDay && peakRainDay.rainfallMm >= 12) {
    alerts.push({
      id: 'derived-heavy-rain',
      type: 'heavy_rain',
      severity: 'High',
      title: `Heavy rain forecast (${peakRainDay.dayLabel})`,
      summary: `${peakRainDay.rainfallMm.toFixed(1)} mm rainfall expected (${peakRainDay.rainProbability}% probability).`,
      action: 'Clear drainage channels, pause irrigation, and keep harvested produce covered.',
      sourceType: 'weather_derived',
      issuedAt: issuedAtIso,
    });
  } else if (prefs.rain && peakProbDay && peakProbDay.rainProbability >= 45) {
    alerts.push({
      id: 'derived-rain',
      type: 'rain',
      severity: 'Moderate',
      title: `Rain likely around ${peakProbDay.dayLabel}`,
      summary: `${peakProbDay.rainProbability}% chance of showers (~${peakProbDay.rainfallMm.toFixed(1)} mm).`,
      action: 'Complete spraying and sun-drying of harvested produce before showers begin.',
      sourceType: 'weather_derived',
      issuedAt: issuedAtIso,
    });
  }

  if (prefs.wind && ((peakWindDay?.windSpeedMax ?? 0) >= 28 || current.windSpeed >= 24)) {
    alerts.push({
      id: 'derived-wind',
      type: 'wind',
      severity: 'Moderate',
      title: `Strong wind advisory (${Math.max(current.windSpeed, peakWindDay?.windSpeedMax ?? 0)} km/h gusts)`,
      summary: 'Gusty winds increase spray drift and staking stress on banana, tomato, and vine trellises.',
      action: 'Delay foliar spraying and reinforce bamboo/wire staking.',
      sourceType: 'weather_derived',
      issuedAt: issuedAtIso,
    });
  }

  if (prefs.temperature && peakTempDay && peakTempDay.maxTemp >= 34) {
    alerts.push({
      id: 'derived-heat',
      type: 'heat',
      severity: peakTempDay.maxTemp >= 38 ? 'High' : 'Moderate',
      title: `High afternoon heat (${peakTempDay.maxTemp}°C on ${peakTempDay.dayLabel})`,
      summary: 'Elevated heat increases moisture stress and wilting in leafy greens and fruiting crops.',
      action: 'Harvest before 9:00 AM and schedule drip irrigation early morning or dusk.',
      sourceType: 'weather_derived',
      issuedAt: issuedAtIso,
    });
  }

  if (avgHumidity >= 78) {
    alerts.push({
      id: 'derived-humidity',
      type: 'humidity',
      severity: 'Low',
      title: `High humidity watch (${avgHumidity}% avg)`,
      summary: 'Sustained humidity raises fungal leaf-spot and mildew risk in solanaceous and vine crops.',
      action: 'Scout lower foliage early morning and maintain canopy airflow.',
      sourceType: 'weather_derived',
      issuedAt: issuedAtIso,
    });
  }

  return alerts;
}

function buildCropAwareAdvisories(
  forecast: ForecastDay[],
  current: {
    humidity: number;
    windSpeed: number;
    rainProbability: number;
    currentTemperature: number;
  },
  savedCropIds: string[],
): FarmAdvisory[] {
  const advisories: FarmAdvisory[] = [];
  const nextRainDay = forecast.find((d) => d.rainProbability >= 50 || d.rainfallMm >= 4);
  const savedSet = new Set(savedCropIds);

  if (nextRainDay) {
    advisories.push({
      id: 'adv-harvest-rain',
      condition: `Rain probability ${nextRainDay.rainProbability}% (${nextRainDay.rainfallMm.toFixed(1)} mm) on ${nextRainDay.dayLabel}`,
      priority: nextRainDay.rainfallMm >= 12 ? 'High' : 'Moderate',
      recommendation: 'Complete picking and covered mandi dispatch ahead of rain',
      reason: 'Wet produce bruises and spoils faster during crate transport, lowering APMC auction grading.',
      timeWindow: `Before ${nextRainDay.dayLabel} afternoon`,
      sourceType: 'weather_derived',
    });
  } else {
    advisories.push({
      id: 'adv-harvest-dry',
      condition: 'Low rainfall risk over the next 72 hours',
      priority: 'Low',
      recommendation: 'Favorable dry window for harvesting, grading, and mandi transport',
      reason: 'Dry conditions preserve skin finish and keep post-harvest moisture loss minimal.',
      timeWindow: 'Next 48–72 hours',
      sourceType: 'weather_derived',
    });
  }

  if (current.windSpeed <= 16 && current.rainProbability < 40) {
    advisories.push({
      id: 'adv-spray-safe',
      condition: `Calm winds (${current.windSpeed} km/h) and dry foliage`,
      priority: 'Low',
      recommendation: 'Suitable early-morning window for foliar nutrients or protective sprays',
      reason: 'Low wind drift ensures even leaf coverage without input wastage.',
      timeWindow: '6:30 AM – 9:30 AM',
      sourceType: 'weather_derived',
    });
  } else {
    advisories.push({
      id: 'adv-spray-hold',
      condition:
        current.rainProbability >= 40
          ? `Rain probability ${current.rainProbability}% today`
          : `Breezy winds (${current.windSpeed} km/h)`,
      priority: 'Moderate',
      recommendation: 'Pause foliar spraying until calmer, drier morning hours',
      reason: 'Rain wash-off or wind drift reduces spray effectiveness and wastes input cost.',
      timeWindow: 'Wait for calm dry morning',
      sourceType: 'weather_derived',
    });
  }

  // Crop-sensitive guidance personalized to what the farmer actually grows
  if (savedSet.has('tomato') && (current.humidity >= 75 || Boolean(nextRainDay))) {
    advisories.push({
      id: 'adv-crop-tomato',
      condition: `Tomato watch · ${current.humidity}% humidity`,
      priority: 'Moderate',
      recommendation: 'Scout tomato lower leaves for early blight and avoid over-irrigation before rain',
      reason: 'Sudden soil moisture swings cause fruit cracking and humid air accelerates leaf spot.',
      timeWindow: 'Today morning inspection',
      sourceType: 'crop_suggestion',
      relatedCropIds: ['tomato'],
    });
  }

  if (savedSet.has('onion') && Boolean(nextRainDay)) {
    advisories.push({
      id: 'adv-crop-onion',
      condition: `Onion curing protection · Rain expected ${nextRainDay?.dayLabel}`,
      priority: 'High',
      recommendation: 'Move field-curing onions under tarpaulin or ventilated shade before showers',
      reason: 'Wet onion necks rapidly develop storage rot and lose Grade-A mandi rates.',
      timeWindow: `Before ${nextRainDay?.dayLabel}`,
      sourceType: 'crop_suggestion',
      relatedCropIds: ['onion'],
    });
  }

  if (savedSet.has('banana') && current.windSpeed >= 18) {
    advisories.push({
      id: 'adv-crop-banana',
      condition: `Banana propping check · Wind ${current.windSpeed} km/h`,
      priority: 'Moderate',
      recommendation: 'Check bamboo props on bunch-bearing banana plants',
      reason: 'Heavy fruiting stems can lodge under gusty winds.',
      timeWindow: 'Today afternoon',
      sourceType: 'crop_suggestion',
      relatedCropIds: ['banana'],
    });
  }

  if (
    (savedSet.has('spinach') || savedSet.has('coriander')) &&
    current.currentTemperature >= 31
  ) {
    advisories.push({
      id: 'adv-crop-leafy',
      condition: `Leafy greens heat care · ${current.currentTemperature}°C`,
      priority: 'Moderate',
      recommendation: 'Harvest spinach/coriander before 7:30 AM and mist shade nets lightly',
      reason: 'Warm midday temperatures wilt leafy bunches rapidly before auction.',
      timeWindow: 'Early morning',
      sourceType: 'crop_suggestion',
      relatedCropIds: ['spinach', 'coriander'].filter((id) => savedSet.has(id)),
    });
  }

  return advisories;
}

export async function getDynamicWeatherForecast(params: {
  locationId: string;
  taluk?: string;
  alertPrefs?: Partial<WeatherAlertPrefs>;
  savedCropIds?: string[];
  forceRefresh?: boolean;
}): Promise<WeatherSnapshot> {
  const location = findLocationById(params.locationId);
  const prefs: WeatherAlertPrefs = {
    rain: params.alertPrefs?.rain ?? true,
    heavyRain: params.alertPrefs?.heavyRain ?? true,
    temperature: params.alertPrefs?.temperature ?? false,
    wind: params.alertPrefs?.wind ?? true,
    dailyForecast: params.alertPrefs?.dailyForecast ?? false,
  };
  const savedCropIds = Array.isArray(params.savedCropIds) ? params.savedCropIds : [];
  const locationLabel = params.taluk
    ? `${params.taluk}, ${location.district}, ${location.state}`
    : `${location.district}, ${location.state}`;

  const cached = weatherCache.get(location.id);
  const isFreshCache =
    !params.forceRefresh && cached && Date.now() - cached.fetchedAtMs < WEATHER_TTL_MS;

  if (isFreshCache && cached) {
    const base = cached.baseSnapshot;
    const derivedAlerts = buildDerivedWeatherAlerts(
      base.forecast,
      {windSpeed: base.windSpeed, humidity: base.humidity},
      prefs,
      base.observedAtIso || new Date(cached.fetchedAtMs).toISOString(),
    );
    return {
      ...base,
      locationName: locationLabel,
      alerts: [...cached.officialImdAlerts, ...derivedAlerts],
      advisories: buildCropAwareAdvisories(base.forecast, base, savedCropIds),
    };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,relative_humidity_2m_mean,wind_speed_10m_max&timezone=Asia%2FKolkata&forecast_days=7`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const [omRes, imdWarnings] = await Promise.all([
      fetch(url, {signal: controller.signal}),
      fetchOfficialImdWarnings(location),
    ]);
    clearTimeout(timeout);

    if (!omRes.ok) {
      throw new Error(`Open-Meteo HTTP ${omRes.status}`);
    }

    const data = (await omRes.json()) as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        weather_code?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
      };
      daily?: {
        time?: string[];
        temperature_2m_min?: number[];
        temperature_2m_max?: number[];
        weather_code?: number[];
        precipitation_probability_max?: number[];
        precipitation_sum?: number[];
        relative_humidity_2m_mean?: number[];
        wind_speed_10m_max?: number[];
        sunrise?: string[];
        sunset?: string[];
      };
    };

    const times = data.daily?.time ?? [];
    const forecast: ForecastDay[] = times.map((dateStr, idx) => {
      const d = new Date(`${dateStr}T00:00:00`);
      return {
        date: dateStr,
        dayLabel:
          idx === 0
            ? 'Today'
            : d.toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric'}),
        minTemp: Math.round(data.daily?.temperature_2m_min?.[idx] ?? 18),
        maxTemp: Math.round(data.daily?.temperature_2m_max?.[idx] ?? 28),
        condition: mapWmoToCondition(Number(data.daily?.weather_code?.[idx] ?? 1)),
        rainProbability: Math.round(data.daily?.precipitation_probability_max?.[idx] ?? 0),
        rainfallMm: Number((data.daily?.precipitation_sum?.[idx] ?? 0).toFixed(1)),
        humidity: Math.round(data.daily?.relative_humidity_2m_mean?.[idx] ?? 65),
        windSpeedMax: Math.round(data.daily?.wind_speed_10m_max?.[idx] ?? 12),
      };
    });

    const observedAtIso = new Date().toISOString();
    const updatedAt = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });

    const baseSnapshot: Omit<WeatherSnapshot, 'alerts' | 'advisories'> = {
      locationId: location.id,
      locationName: locationLabel,
      currentTemperature: Math.round(data.current?.temperature_2m ?? 0),
      feelsLike: Math.round(data.current?.apparent_temperature ?? data.current?.temperature_2m ?? 0),
      condition: mapWmoToCondition(Number(data.current?.weather_code ?? 1)),
      humidity: Math.round(data.current?.relative_humidity_2m ?? 0),
      windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
      windDirection: degreesToCardinal(Number(data.current?.wind_direction_10m ?? 0)),
      rainProbability: forecast[0]?.rainProbability ?? 0,
      sunrise: formatTimeHHMM(data.daily?.sunrise?.[0] ?? ''),
      sunset: formatTimeHHMM(data.daily?.sunset?.[0] ?? ''),
      source: 'live',
      sourceLabel:
        imdWarnings.length > 0
          ? 'Live IMD Warnings + Open-Meteo Forecast'
          : 'Live Open-Meteo Forecast',
      officialProvider: imdWarnings.length > 0 ? 'imd_and_open_meteo' : 'open_meteo',
      isStale: false,
      observedAtIso,
      updatedAt: `${updatedAt} IST`,
      forecast,
    };

    weatherCache.set(location.id, {
      fetchedAtMs: Date.now(),
      baseSnapshot,
      officialImdAlerts: imdWarnings,
    });

    const derivedAlerts = buildDerivedWeatherAlerts(
      forecast,
      {windSpeed: baseSnapshot.windSpeed, humidity: baseSnapshot.humidity},
      prefs,
      observedAtIso,
    );

    return {
      ...baseSnapshot,
      alerts: [...imdWarnings, ...derivedAlerts],
      advisories: buildCropAwareAdvisories(forecast, baseSnapshot, savedCropIds),
    };
  } catch (err: unknown) {
    // Never fabricate fake weather if upstream fails — use last verified cache if present, else throw
    if (cached) {
      const base = cached.baseSnapshot;
      const derivedAlerts = buildDerivedWeatherAlerts(
        base.forecast,
        {windSpeed: base.windSpeed, humidity: base.humidity},
        prefs,
        base.observedAtIso || new Date(cached.fetchedAtMs).toISOString(),
      );
      return {
        ...base,
        locationName: locationLabel,
        source: 'cached',
        officialProvider: 'cached_open_meteo',
        sourceLabel: `${base.sourceLabel} (Cached)`,
        isStale: true,
        staleReason: 'Live weather provider temporarily unreachable; showing last verified observation.',
        alerts: [...cached.officialImdAlerts, ...derivedAlerts],
        advisories: buildCropAwareAdvisories(base.forecast, base, savedCropIds),
      };
    }

    const msg = err instanceof Error ? err.message : 'Unable to reach live weather provider.';
    throw new Error(msg);
  }
}
