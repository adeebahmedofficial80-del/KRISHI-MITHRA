import {
  CloudRain,
  CloudSun,
  Droplets,
  RefreshCw,
  ShieldAlert,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import {useState} from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {TranslationPack} from '../data/translations';
import {LanguageCode, LocationOption, WeatherAlertPrefs, WeatherSnapshot} from '../types/krishi';

interface WeatherViewProps {
  t: TranslationPack;
  language: LanguageCode;
  location: LocationOption;
  weather: WeatherSnapshot | null;
  loading: boolean;
  onRefresh: () => void;
  alertPrefs: WeatherAlertPrefs;
  onUpdateAlertPrefs: (patch: Partial<WeatherAlertPrefs>) => void;
  audioActiveKey: string | null;
  audioLoadingKey: string | null;
  onListen: (params: {
    key: string;
    text: string;
    language: LanguageCode;
    quickSummarizeTopic?: string;
    quickSummarizePayload?: Record<string, unknown>;
  }) => void;
}

export function WeatherView({
  t,
  language,
  location,
  weather,
  loading,
  onRefresh,
  alertPrefs,
  onUpdateAlertPrefs,
  audioActiveKey,
  audioLoadingKey,
  onListen,
}: WeatherViewProps) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  if (!weather) {
    return (
      <div className="bg-white border border-[#E4E9E0] rounded-2xl p-8 text-center text-sm text-[#6B756A]">
        Loading weather forecast for {location.name}...
      </div>
    );
  }

  const selectedDay = weather.forecast[selectedDayIdx] || weather.forecast[0];
  const audioKey = `weather-${weather.locationId}`;
  const isPlaying = audioActiveKey === audioKey;
  const isAudioLoading = audioLoadingKey === audioKey;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#245C3A]">
              {weather.locationName} · {weather.sourceLabel}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#202820]">
              {t.weatherTitle}
            </h1>
            <p className="mt-1 text-sm text-[#6B756A]">{t.weatherSubtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isAudioLoading}
              onClick={() =>
                onListen({
                  key: audioKey,
                  text: `Weather for ${weather.locationName}. Currently ${weather.currentTemperature} degrees Celsius, ${weather.condition}. Humidity ${weather.humidity} percent, wind ${weather.windSpeed} kilometers per hour, rain chance ${weather.rainProbability} percent. ${weather.advisories[0]?.recommendation || ''}`,
                  language,
                  quickSummarizeTopic: `Farm weather summary for ${location.name}`,
                  quickSummarizePayload: {
                    location: weather.locationName,
                    tempC: weather.currentTemperature,
                    rainChance: weather.rainProbability,
                    humidity: weather.humidity,
                    advisory: weather.advisories[0]?.recommendation,
                  },
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm font-semibold text-[#202820] hover:bg-[#EAF3E8] cursor-pointer"
            >
              {isPlaying ? (
                <VolumeX className="w-4 h-4 text-[#245C3A]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#245C3A]" />
              )}
              <span>
                {isAudioLoading ? t.loadingAudio : isPlaying ? t.stopAudio : t.listenSummary}
              </span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E4E9E0] bg-white text-sm font-medium text-[#202820] hover:bg-[#FAF9F4] cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Current Conditions Grid */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5 rounded-2xl border border-[#E4E9E0] bg-[#FAF9F4] p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
                Right Now · {weather.updatedAt}
              </p>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-5xl font-bold text-[#202820] tabular-nums">
                  {weather.currentTemperature}°C
                </span>
                <span className="text-sm font-medium text-[#6B756A]">
                  {t.feelsLike} {weather.feelsLike}°C
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-[#245C3A]">
                {t.weatherConditions[weather.condition] || weather.condition}
              </p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-[#EAF3E8] text-[#245C3A] flex items-center justify-center shrink-0">
              {weather.rainProbability >= 50 ? (
                <CloudRain className="w-8 h-8 text-[#5A91C8]" />
              ) : weather.condition === 'Sunny' ? (
                <Sun className="w-8 h-8 text-amber-500" />
              ) : (
                <CloudSun className="w-8 h-8 text-[#245C3A]" />
              )}
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[#E4E9E0] bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B756A]">
                <CloudRain className="w-3.5 h-3.5 text-[#5A91C8]" />
                <span>{t.rainProbability}</span>
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold text-[#202820] tabular-nums">
                {weather.rainProbability}%
              </p>
            </div>

            <div className="rounded-xl border border-[#E4E9E0] bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B756A]">
                <Droplets className="w-3.5 h-3.5 text-[#5A91C8]" />
                <span>{t.humidityLabel}</span>
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold text-[#202820] tabular-nums">
                {weather.humidity}%
              </p>
            </div>

            <div className="rounded-xl border border-[#E4E9E0] bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B756A]">
                <Wind className="w-3.5 h-3.5 text-[#245C3A]" />
                <span>{t.windLabel}</span>
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold text-[#202820] tabular-nums">
                {weather.windSpeed} <span className="text-xs font-normal">km/h {weather.windDirection}</span>
              </p>
            </div>

            <div className="rounded-xl border border-[#E4E9E0] bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B756A]">
                <Sunrise className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {t.sunrise} / {t.sunset}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-xs font-bold text-[#202820] tabular-nums">
                {weather.sunrise}
              </p>
              <p className="font-mono text-xs text-[#6B756A] tabular-nums flex items-center gap-1">
                <Sunset className="w-3 h-3" /> {weather.sunset}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7-Day Interactive Strip */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#202820]">{t.sevenDayForecast}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {weather.forecast.map((day, idx) => {
            const active = selectedDayIdx === idx;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDayIdx(idx)}
                className={`rounded-xl border p-3 text-left cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#EAF3E8] border-[#245C3A] ring-1 ring-[#245C3A]'
                    : 'bg-[#FAF9F4] border-[#E4E9E0] hover:bg-white'
                }`}
              >
                <p className="text-xs font-semibold text-[#202820]">{day.dayLabel}</p>
                <p className="text-[11px] text-[#6B756A] truncate mt-0.5">
                  {t.weatherConditions[day.condition] || day.condition}
                </p>
                <p className="mt-2 font-mono text-base font-bold text-[#202820] tabular-nums">
                  {day.maxTemp}° <span className="text-xs font-normal text-[#6B756A]">/ {day.minTemp}°</span>
                </p>
                <p className="mt-1 font-mono text-xs font-semibold text-[#5A91C8] tabular-nums">
                  {day.rainProbability}% · {day.rainfallMm} mm
                </p>
              </button>
            );
          })}
        </div>

        {selectedDay && (
          <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <span className="font-semibold text-[#202820]">{selectedDay.dayLabel}:</span>{' '}
              <span className="text-[#6B756A]">
                {t.weatherConditions[selectedDay.condition] || selectedDay.condition}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 font-mono text-xs text-[#202820] tabular-nums">
              <span>High {selectedDay.maxTemp}°C</span>
              <span>Low {selectedDay.minTemp}°C</span>
              <span>Rain {selectedDay.rainfallMm} mm ({selectedDay.rainProbability}%)</span>
              <span>Humidity {selectedDay.humidity}%</span>
            </div>
          </div>
        )}
      </section>

      {/* Temperature & Rainfall Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#E4E9E0] rounded-2xl p-5">
          <h3 className="text-base font-bold text-[#202820] mb-3">{t.temperatureChartTitle}</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weather.forecast} margin={{top: 8, right: 12, left: -16, bottom: 4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E0" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{fontSize: 11, fill: '#6B756A'}} tickLine={false} />
                <YAxis tick={{fontSize: 11, fill: '#6B756A'}} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{fontSize: '12px'}} />
                <Line
                  type="monotone"
                  dataKey="maxTemp"
                  name="Max °C"
                  stroke="#D97706"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="minTemp"
                  name="Min °C"
                  stroke="#245C3A"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#E4E9E0] rounded-2xl p-5">
          <h3 className="text-base font-bold text-[#202820] mb-3">{t.rainfallChartTitle}</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weather.forecast} margin={{top: 8, right: 12, left: -16, bottom: 4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E0" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{fontSize: 11, fill: '#6B756A'}} tickLine={false} />
                <YAxis tick={{fontSize: 11, fill: '#6B756A'}} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{fontSize: '12px'}} />
                <Bar dataKey="rainfallMm" name="Rainfall (mm)" fill="#5A91C8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Alerts & Farm Weather Advisories */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border border-[#E4E9E0] rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#245C3A]" />
            <h2 className="text-lg font-bold text-[#202820]">{t.weatherAlertsTitle}</h2>
          </div>

          <div className="space-y-2.5">
            {weather.alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#202820]">{alert.title}</p>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      alert.severity === 'High'
                        ? 'bg-amber-100 text-amber-900'
                        : alert.severity === 'Moderate'
                          ? 'bg-[#EAF3E8] text-[#245C3A]'
                          : 'bg-white text-[#6B756A] border border-[#E4E9E0]'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <p className="text-xs text-[#6B756A]">{alert.summary}</p>
                <p className="text-xs font-medium text-[#245C3A]">{alert.action}</p>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#E4E9E0]">
            <p className="text-xs font-semibold text-[#6B756A] uppercase tracking-wider mb-2">
              {t.alertPreferencesTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  {key: 'rain', label: 'Rain'},
                  {key: 'heavyRain', label: 'Heavy Rain'},
                  {key: 'temperature', label: 'Heat'},
                  {key: 'wind', label: 'Wind'},
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E9E0] bg-[#FAF9F4] text-xs font-medium cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={alertPrefs[item.key]}
                    onChange={(e) => onUpdateAlertPrefs({[item.key]: e.target.checked})}
                    className="accent-[#245C3A]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E4E9E0] rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-bold text-[#202820]">{t.farmWeatherAdvisoryTitle}</h2>
          <div className="space-y-3">
            {weather.advisories.map((adv) => (
              <div
                key={adv.id}
                className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-4 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#202820]">{adv.recommendation}</p>
                  <span className="font-mono text-xs text-[#245C3A] font-semibold">
                    {adv.timeWindow}
                  </span>
                </div>
                <p className="text-xs text-[#6B756A]">
                  <strong className="text-[#202820]">Condition:</strong> {adv.condition}
                </p>
                <p className="text-xs text-[#6B756A]">{adv.reason}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#6B756A] pt-1">{t.advisoryDisclaimer}</p>
        </div>
      </section>
    </div>
  );
}
