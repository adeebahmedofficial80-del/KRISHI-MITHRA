import {
  FarmAdvisory,
  ForecastDay,
  LocationOption,
  WeatherAlertItem,
  WeatherAlertPrefs,
  WeatherSnapshot,
} from '../types/krishi';

const WEATHER_CACHE_KEY = 'km_weather_cache_v1';

export interface WeatherDataProvider {
  getForecast(location: LocationOption, alertPrefs: WeatherAlertPrefs): Promise<WeatherSnapshot>;
}

function mapWmoToCondition(code: number): ForecastDay['condition'] {
  if (code === 0) return 'Sunny';
  if (code === 1) return 'Mostly sunny';
  if (code === 2) return 'Partly cloudy';
  if (code === 3 || code === 45 || code === 48) return 'Cloudy';
  if (code >= 51 && code <= 61) return 'Light rain';
  if (code === 80) return 'Light rain';
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

export function generateWeatherAlerts(
  forecast: ForecastDay[],
  prefs: WeatherAlertPrefs,
): WeatherAlertItem[] {
  const alerts: WeatherAlertItem[] = [];
  const nextThree = forecast.slice(0, 3);
  const peakRainDay = [...nextThree].sort((a, b) => b.rainfallMm - a.rainfallMm)[0];
  const peakProbDay = [...nextThree].sort((a, b) => b.rainProbability - a.rainProbability)[0];
  const peakTempDay = [...nextThree].sort((a, b) => b.maxTemp - a.maxTemp)[0];
  const avgHumidity = Math.round(
    nextThree.reduce((acc, d) => acc + d.humidity, 0) / Math.max(1, nextThree.length),
  );

  if (prefs.heavyRain && peakRainDay && peakRainDay.rainfallMm >= 12) {
    alerts.push({
      id: 'heavy-rain',
      type: 'heavy_rain',
      severity: 'High',
      title: `Heavy rain expected (${peakRainDay.dayLabel})`,
      summary: `${peakRainDay.rainfallMm.toFixed(1)} mm rainfall expected (${peakRainDay.rainProbability}% chance).`,
      action: 'Clear field drainage channels and cover harvested crates before midday.',
    });
  } else if (prefs.rain && peakProbDay && peakProbDay.rainProbability >= 45) {
    alerts.push({
      id: 'light-rain',
      type: 'rain',
      severity: 'Moderate',
      title: `Rain likely around ${peakProbDay.dayLabel}`,
      summary: `${peakProbDay.rainProbability}% chance of showers (~${peakProbDay.rainfallMm.toFixed(1)} mm).`,
      action: 'Finish foliar sprays and sun-drying of onions or chillies ahead of showers.',
    });
  }

  if (prefs.temperature && peakTempDay && peakTempDay.maxTemp >= 33) {
    alerts.push({
      id: 'heat-watch',
      type: 'heat',
      severity: 'Moderate',
      title: `Warm afternoon temperatures (${peakTempDay.maxTemp}°C)`,
      summary: 'Higher midday warmth can increase evapotranspiration and wilting in leafy greens.',
      action: 'Schedule harvest before 9:00 AM and irrigate during early morning or evening.',
    });
  }

  if (avgHumidity >= 75) {
    alerts.push({
      id: 'humidity-watch',
      type: 'humidity',
      severity: 'Low',
      title: `Elevated air moisture (${avgHumidity}% avg humidity)`,
      summary: 'Humid mornings may encourage leaf spot or blight in tomato, potato, and grapes.',
      action: 'Inspect lower leaves early morning and ensure good spacing and airflow.',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'clear-window',
      type: 'rain',
      severity: 'Low',
      title: 'Favorable field window ahead',
      summary: 'No severe rain or extreme temperature warnings detected for the next 72 hours.',
      action: 'Good conditions for harvesting, crate grading, and transporting produce to mandi.',
    });
  }

  return alerts;
}

export function generateFarmAdvisories(
  forecast: ForecastDay[],
  current: {humidity: number; windSpeed: number; rainProbability: number; currentTemperature: number},
): FarmAdvisory[] {
  const nextRainDay = forecast.find((d) => d.rainProbability >= 50 || d.rainfallMm >= 4);
  const advisories: FarmAdvisory[] = [];

  if (nextRainDay) {
    advisories.push({
      id: 'adv-harvest',
      condition: `Rain chance ${nextRainDay.rainProbability}% on ${nextRainDay.dayLabel}`,
      priority: nextRainDay.rainfallMm >= 10 ? 'High' : 'Moderate',
      recommendation: 'Plan picking and covered transport ahead of showers',
      reason:
        'Wet produce spoils faster in transit crates and can lower grading price at APMC auctions.',
      timeWindow: `Before ${nextRainDay.dayLabel} afternoon`,
    });
  } else {
    advisories.push({
      id: 'adv-harvest-dry',
      condition: 'Low rain probability across the next 3 days',
      priority: 'Low',
      recommendation: 'Good window for field curing and mandi dispatch',
      reason:
        'Dry air helps cure onion necks, potatoes, and chillies cleanly with minimal moisture loss.',
      timeWindow: 'Next 48–72 hours',
    });
  }

  if (current.windSpeed <= 16 && current.rainProbability < 40) {
    advisories.push({
      id: 'adv-spray',
      condition: `Moderate wind (${current.windSpeed} km/h) and dry foliage`,
      priority: 'Low',
      recommendation: 'Safe morning window for foliar nutrients or protective sprays',
      reason: 'Low wind drift keeps spray coverage on crop leaves rather than drifting off-target.',
      timeWindow: '6:30 AM – 9:30 AM',
    });
  } else {
    advisories.push({
      id: 'adv-spray-delay',
      condition:
        current.rainProbability >= 40
          ? `Rain probability ${current.rainProbability}% today`
          : `Breezy winds (${current.windSpeed} km/h)`,
      priority: 'Moderate',
      recommendation: 'Hold foliar spraying until calmer, drier hours',
      reason: 'Rain wash-off or strong wind reduces spray effectiveness and wastes input cost.',
      timeWindow: 'Wait for calm dry morning',
    });
  }

  advisories.push({
    id: 'adv-irrigation',
    condition: `Current temp ${current.currentTemperature}°C · Humidity ${current.humidity}%`,
    priority: current.currentTemperature >= 31 ? 'Moderate' : 'Low',
    recommendation:
      nextRainDay && nextRainDay.rainfallMm >= 5
        ? 'Reduce drip irrigation cycles before expected rain'
        : 'Maintain light morning irrigation for fruiting crops',
    reason:
      nextRainDay && nextRainDay.rainfallMm >= 5
        ? 'Avoiding over-saturation prevents root stress and fruit cracking in tomato and pomegranate.'
        : 'Steady morning moisture supports uniform fruit sizing in tomato, brinjal, and banana.',
    timeWindow: 'Morning 6:00 AM – 8:30 AM',
  });

  return advisories;
}

export class DemoWeatherDataProvider implements WeatherDataProvider {
  async getForecast(
    location: LocationOption,
    alertPrefs: WeatherAlertPrefs,
  ): Promise<WeatherSnapshot> {
    const baseDate = new Date();
    const offsets = [0, 1, 2, 3, 4, 5, 6];
    const codes = [1, 2, 61, 80, 2, 1, 0];
    const probs = [20, 35, 65, 55, 25, 15, 10];
    const rains = [0.2, 1.4, 8.6, 5.2, 0.4, 0, 0];
    const mins = [18, 19, 18, 18, 17, 17, 18];
    const maxs = [28, 27, 25, 26, 28, 29, 30];
    const hums = [68, 74, 82, 78, 69, 64, 60];

    const forecast: ForecastDay[] = offsets.map((offset, idx) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + offset);
      return {
        date: d.toISOString().slice(0, 10),
        dayLabel:
          offset === 0
            ? 'Today'
            : d.toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric'}),
        minTemp: mins[idx],
        maxTemp: maxs[idx],
        condition: mapWmoToCondition(codes[idx]),
        rainProbability: probs[idx],
        rainfallMm: rains[idx],
        humidity: hums[idx],
      };
    });

    const current = {
      currentTemperature: 26,
      feelsLike: 27,
      condition: 'Mostly sunny' as ForecastDay['condition'],
      humidity: 68,
      windSpeed: 11,
      windDirection: 'E',
      rainProbability: forecast[0].rainProbability,
    };

    return {
      locationId: location.id,
      locationName: `${location.name}, ${location.state}`,
      ...current,
      sunrise: '6:22 AM',
      sunset: '5:51 PM',
      source: 'demo',
      sourceLabel: 'Demo forecast (offline fallback)',
      updatedAt: new Date().toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'}),
      forecast,
      alerts: generateWeatherAlerts(forecast, alertPrefs),
      advisories: generateFarmAdvisories(forecast, current),
    };
  }
}

export class OpenMeteoWeatherProvider implements WeatherDataProvider {
  private fallback = new DemoWeatherDataProvider();

  private readCache(locationId: string): WeatherSnapshot | null {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, {savedAt: number; snapshot: WeatherSnapshot}>;
      const entry = parsed[locationId];
      if (!entry) return null;
      // Valid for up to 12 hours as offline cache
      if (Date.now() - entry.savedAt > 12 * 60 * 60 * 1000) return null;
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
  ): Promise<WeatherSnapshot> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,relative_humidity_2m_mean&timezone=Asia%2FKolkata&forecast_days=7`;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 7000);
      const res = await fetch(url, {signal: controller.signal});
      window.clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Open-Meteo HTTP ${res.status}`);
      }
      const data = await res.json();
      const times: string[] = data.daily?.time ?? [];
      const forecast: ForecastDay[] = times.map((dateStr, idx) => {
        const d = new Date(`${dateStr}T00:00:00`);
        return {
          date: dateStr,
          dayLabel:
            idx === 0
              ? 'Today'
              : d.toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric'}),
          minTemp: Math.round(data.daily.temperature_2m_min?.[idx] ?? 18),
          maxTemp: Math.round(data.daily.temperature_2m_max?.[idx] ?? 28),
          condition: mapWmoToCondition(Number(data.daily.weather_code?.[idx] ?? 1)),
          rainProbability: Math.round(data.daily.precipitation_probability_max?.[idx] ?? 15),
          rainfallMm: Number((data.daily.precipitation_sum?.[idx] ?? 0).toFixed(1)),
          humidity: Math.round(data.daily.relative_humidity_2m_mean?.[idx] ?? 68),
        };
      });

      const current = {
        currentTemperature: Math.round(data.current?.temperature_2m ?? 26),
        feelsLike: Math.round(data.current?.apparent_temperature ?? 27),
        condition: mapWmoToCondition(Number(data.current?.weather_code ?? 1)),
        humidity: Math.round(data.current?.relative_humidity_2m ?? 65),
        windSpeed: Math.round(data.current?.wind_speed_10m ?? 10),
        windDirection: degreesToCardinal(Number(data.current?.wind_direction_10m ?? 90)),
        rainProbability: forecast[0]?.rainProbability ?? 20,
      };

      const snapshot: WeatherSnapshot = {
        locationId: location.id,
        locationName: `${location.name}, ${location.state}`,
        ...current,
        sunrise: formatTimeHHMM(data.daily?.sunrise?.[0] ?? ''),
        sunset: formatTimeHHMM(data.daily?.sunset?.[0] ?? ''),
        source: 'live',
        sourceLabel: 'Live Open-Meteo forecast',
        updatedAt: new Date().toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'}),
        forecast,
        alerts: generateWeatherAlerts(forecast, alertPrefs),
        advisories: generateFarmAdvisories(forecast, current),
      };

      this.writeCache(location.id, snapshot);
      return snapshot;
    } catch {
      const cached = this.readCache(location.id);
      if (cached) {
        return {
          ...cached,
          alerts: generateWeatherAlerts(cached.forecast, alertPrefs),
          sourceLabel: `${cached.sourceLabel} (cached)`,
        };
      }
      return this.fallback.getForecast(location, alertPrefs);
    }
  }
}

export const weatherProvider: WeatherDataProvider = new OpenMeteoWeatherProvider();
