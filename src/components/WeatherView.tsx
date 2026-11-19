import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sprout,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {TranslationPack} from '../data/translations';
import {
  ForecastDay,
  LanguageCode,
  LocationOption,
  WeatherAdvisorySourceType,
  WeatherAlertPrefs,
  WeatherSnapshot,
} from '../types/krishi';

interface WeatherViewProps {
  t: TranslationPack;
  language: LanguageCode;
  farmerName: string;
  location: LocationOption;
  weather: WeatherSnapshot | null;
  loading: boolean;
  weatherError: string | null;
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

function getSourceBadge(sourceType?: WeatherAdvisorySourceType): {
  label: string;
  className: string;
} {
  if (sourceType === 'official_imd' || sourceType === 'official_grounded') {
    return {
      label: sourceType === 'official_imd' ? 'Official IMD' : 'Official Bulletin (Cited)',
      className: 'bg-red-50 text-red-800 border border-red-200',
    };
  }
  if (sourceType === 'crop_suggestion') {
    return {
      label: 'Crop Advisory',
      className: 'bg-[#EAF3E8] text-[#245C3A] border border-[#245C3A]/20',
    };
  }
  if (sourceType === 'ai_summary') {
    return {
      label: 'AI Summary',
      className: 'bg-amber-50 text-amber-900 border border-amber-200',
    };
  }
  return {
    label: 'Forecast-Derived',
    className: 'bg-white text-[#6B756A] border border-[#E4E9E0]',
  };
}

function WeatherConditionIcon({
  condition,
  rainProbability,
  className = 'w-5 h-5',
}: {
  condition?: string | null;
  rainProbability?: number | null;
  className?: string;
}) {
  const c = (condition || '').toLowerCase();
  if (c.includes('thunder') || c.includes('storm') || c.includes('lightning')) {
    return <CloudLightning className={`${className} text-amber-600`} />;
  }
  if (
    c.includes('rain') ||
    c.includes('shower') ||
    c.includes('drizzle') ||
    (rainProbability !== null && rainProbability !== undefined && rainProbability >= 60)
  ) {
    return <CloudRain className={`${className} text-[#5A91C8]`} />;
  }
  if (c.includes('fog') || c.includes('mist') || c.includes('haze') || c.includes('smoke')) {
    return <CloudFog className={`${className} text-[#6B756A]`} />;
  }
  if (c.includes('overcast') || c === 'cloudy' || c.includes('mostly cloudy')) {
    return <Cloud className={`${className} text-[#6B756A]`} />;
  }
  if (c.includes('wind') || c.includes('breez') || c.includes('gust')) {
    return <Wind className={`${className} text-[#245C3A]`} />;
  }
  if (c.includes('sun') || c.includes('clear')) {
    return <Sun className={`${className} text-amber-500`} />;
  }
  return <CloudSun className={`${className} text-[#245C3A]`} />;
}

interface CustomTooltipPayloadItem {
  payload?: ForecastDay & {axisLabel: string};
}

function TemperatureChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || !payload[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-[#D4DCD0] bg-white px-3.5 py-2.5 shadow-md text-xs space-y-1 max-w-[220px]">
      <p className="font-bold text-[#202820]">
        {d.weekday}, {d.shortDate} <span className="font-normal text-[#6B756A]">({d.date})</span>
      </p>
      <p className="text-[#245C3A] font-medium">{d.condition || 'Condition unavailable'}</p>
      <div className="flex items-center gap-3 font-mono tabular-nums pt-0.5">
        <span className="text-amber-700 font-semibold">
          Max: {d.maxTemp !== null ? `${d.maxTemp}°C` : 'Unavailable'}
        </span>
        <span className="text-[#245C3A] font-semibold">
          Min: {d.minTemp !== null ? `${d.minTemp}°C` : 'Unavailable'}
        </span>
      </div>
      <p className="font-mono text-[#3B71A8] tabular-nums">
        Rain Prob: {d.rainProbability !== null ? `${d.rainProbability}%` : 'Unavailable'}
        {d.rainfallMm !== null ? ` (${d.rainfallMm} mm)` : ''}
      </p>
      {d.warning && <p className="text-amber-800 font-semibold pt-0.5">Warning: {d.warning}</p>}
    </div>
  );
}

function RainChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || !payload[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-[#D4DCD0] bg-white px-3.5 py-2.5 shadow-md text-xs space-y-1 max-w-[220px]">
      <p className="font-bold text-[#202820]">
        {d.weekday}, {d.shortDate}
      </p>
      <p className="font-mono font-semibold text-[#3B71A8] tabular-nums">
        Rain Probability: {d.rainProbability !== null ? `${d.rainProbability}%` : 'Unavailable'}
      </p>
      <p className="font-mono text-[#5B675B] tabular-nums">
        Expected Rainfall: {d.rainfallMm !== null ? `${d.rainfallMm} mm` : 'Not specified'}
      </p>
      <p className="text-[#6B756A]">{d.condition || 'Condition unavailable'}</p>
    </div>
  );
}

export function WeatherView({
  t,
  language,
  farmerName,
  location,
  weather,
  loading,
  weatherError,
  onRefresh,
  alertPrefs,
  onUpdateAlertPrefs,
  audioActiveKey,
  audioLoadingKey,
  onListen,
}: WeatherViewProps) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const visibleAlerts = useMemo(() => {
    if (!weather?.alerts) return [];
    const filtered = weather.alerts.filter((alert) => {
      // Always display official IMD or cited weather warnings regardless of filter checkboxes
      if (alert.sourceType === 'official_imd' || alert.sourceType === 'official_grounded') {
        return true;
      }
      if (alert.id === 'derived-clear') return true;
      if (alert.type === 'rain' && !alertPrefs.rain) return false;
      if (alert.type === 'heavy_rain' && !alertPrefs.heavyRain) return false;
      if (alert.type === 'heat' && !alertPrefs.temperature) return false;
      if (alert.type === 'wind' && !alertPrefs.wind) return false;
      return true;
    });
    return filtered.length > 0 ? filtered : weather.alerts.slice(0, 1);
  }, [weather, alertPrefs]);

  const chartData = useMemo(() => {
    if (!weather?.forecast) return [];
    return weather.forecast.slice(0, 7).map((day, idx) => ({
      ...day,
      axisLabel: idx === 0 ? `${day.shortDate}` : `${day.weekday} ${day.shortDate.split(' ')[0]}`,
    }));
  }, [weather]);

  const hasTempSeries = useMemo(
    () => chartData.some((d) => d.maxTemp !== null || d.minTemp !== null),
    [chartData],
  );
  const hasRainProbSeries = useMemo(
    () => chartData.some((d) => d.rainProbability !== null),
    [chartData],
  );

  if (!weather && loading) {
    return (
      <div className="bg-white border border-[#E4E9E0] rounded-2xl p-10 text-center space-y-3">
        <Loader2 className="w-7 h-7 text-[#245C3A] animate-spin mx-auto" />
        <p className="text-sm font-semibold text-[#202820]">
          Retrieving current weather &amp; 7-day forecast for {location.district}, {location.state}{' '}
          via Gemini Google Search...
        </p>
        <p className="text-xs text-[#6B756A]">
          Checking IMD and reliable weather sources for your exact saved location.
        </p>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-white border border-amber-200 rounded-2xl p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-700 mx-auto" />
        <h2 className="text-lg font-bold text-[#202820]">Live Weather Temporarily Unavailable</h2>
        <p className="text-sm text-[#6B756A] max-w-md mx-auto">
          {weatherError ||
            `We could not retrieve a live weather forecast for ${location.district}, ${location.state} via Gemini Search right now. KRISHI-MITHRA never shows fabricated weather figures.`}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Refreshing Weather...' : 'Refresh Weather'}</span>
        </button>
      </div>
    );
  }

  const safeDayIdx = Math.min(selectedDayIdx, Math.max(0, weather.forecast.length - 1));
  const selectedDay = weather.forecast[safeDayIdx] || weather.forecast[0];
  const audioKey = `weather-${weather.locationId}`;
  const isPlaying = audioActiveKey === audioKey;
  const isAudioLoading = audioLoadingKey === audioKey;

  const spokenWeatherParts: string[] = [`Hello ${farmerName}. Weather for ${weather.locationName}.`];
  if (weather.currentTemperature !== null) {
    spokenWeatherParts.push(`Currently ${weather.currentTemperature} degrees Celsius`);
  }
  if (weather.condition) {
    spokenWeatherParts.push(weather.condition);
  }
  if (weather.todayMinTemp !== null && weather.todayMaxTemp !== null) {
    spokenWeatherParts.push(
      `Today's forecast ranges from ${weather.todayMinTemp} to ${weather.todayMaxTemp} degrees Celsius.`,
    );
  }
  if (weather.humidity !== null) {
    spokenWeatherParts.push(`Humidity ${weather.humidity} percent.`);
  }
  if (weather.rainProbability !== null) {
    spokenWeatherParts.push(`Rain probability ${weather.rainProbability} percent.`);
  }
  if (weather.advisories[0]?.recommendation) {
    spokenWeatherParts.push(weather.advisories[0].recommendation);
  }

  return (
    <div className="space-y-6">
      {/* Header + Current Observed Conditions vs Today's Forecast */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#245C3A]">
              {weather.locationName} · {weather.sourceLabel}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#202820]">
              {t.weatherTitle}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6B756A]">
              Personalized for {farmerName} · Retrieved {weather.updatedAt}
              {weather.forecastPublishedAt ? ` · Published ${weather.forecastPublishedAt}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isAudioLoading}
              onClick={() =>
                onListen({
                  key: audioKey,
                  text: spokenWeatherParts.join(' '),
                  language,
                  quickSummarizeTopic: `Farm weather summary for ${farmerName} in ${weather.locationName}`,
                  quickSummarizePayload: {
                    farmerName,
                    location: weather.locationName,
                    tempC: weather.currentTemperature,
                    todayMinC: weather.todayMinTemp,
                    todayMaxC: weather.todayMaxTemp,
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
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#245C3A] hover:bg-[#1d4b2f] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Weather'}</span>
            </button>
          </div>
        </div>

        {/* Stale / Cache Fallback Notice */}
        {weather.isStale && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-950">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              {weather.staleReason ||
                `Showing previous verified forecast from ${weather.observationDate || weather.updatedAt}.`}
            </span>
          </div>
        )}

        {/* Current Observed Conditions vs Today's Forecast Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Actual Current Conditions */}
          <div className="lg:col-span-5 rounded-2xl border border-[#E4E9E0] bg-[#FAF9F4] p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#245C3A]">
                Actual Current Conditions
              </p>
              <p className="text-[11px] text-[#6B756A] mt-0.5">
                Observed: {weather.observationDate || weather.updatedAt}
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-mono text-4xl sm:text-5xl font-bold text-[#202820] tabular-nums">
                  {weather.currentTemperature !== null ? `${weather.currentTemperature}°C` : '—'}
                </span>
                {weather.feelsLike !== null && (
                  <span className="text-xs sm:text-sm font-medium text-[#6B756A]">
                    {t.feelsLike} {weather.feelsLike}°C
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm font-semibold text-[#245C3A]">
                {weather.condition
                  ? t.weatherConditions[weather.condition] || weather.condition
                  : 'Current condition unavailable'}
              </p>
              {(weather.todayMinTemp !== null || weather.todayMaxTemp !== null) && (
                <p className="mt-1 text-xs text-[#5B675B]">
                  <span className="font-semibold text-[#202820]">Today&apos;s Forecast Range:</span>{' '}
                  <span className="font-mono tabular-nums">
                    {weather.todayMinTemp !== null ? `${weather.todayMinTemp}°C` : '—'} min /{' '}
                    {weather.todayMaxTemp !== null ? `${weather.todayMaxTemp}°C` : '—'} max
                  </span>
                </p>
              )}
              {weather.todayForecastCondition &&
                weather.todayForecastCondition !== weather.condition && (
                  <p className="mt-0.5 text-xs text-[#6B756A]">
                    Forecast outlook: {weather.todayForecastCondition}
                  </p>
                )}
            </div>
            <div className="w-16 h-16 rounded-2xl bg-[#EAF3E8] flex items-center justify-center shrink-0">
              <WeatherConditionIcon
                condition={weather.condition || weather.todayForecastCondition}
                rainProbability={weather.rainProbability}
                className="w-8 h-8"
              />
            </div>
          </div>

          {/* Key Weather Metrics Grid */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[#E4E9E0] bg-white p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[#6B756A]">
                <CloudRain className="w-3.5 h-3.5 text-[#5A91C8]" />
                <span>{t.rainProbability}</span>
              </div>
              <p className="mt-2 font-mono text-xl font-bold text-[#202820] tabular-nums">
                {weather.rainProbability !== null ? `${weather.rainProbability}%` : 'Unavailable'}
              </p>
              <p className="text-[10px] text-[#6B756A] mt-0.5">Today&apos;s forecast</p>
            </div>

            <div className="rounded-xl border border-[#E4E9E0] bg-white p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[#6B756A]">
                <Droplets className="w-3.5 h-3.5 text-[#5A91C8]" />
                <span>{t.humidityLabel}</span>
              </div>
              <p className="mt-2 font-mono text-xl font-bold text-[#202820] tabular-nums">
                {weather.humidity !== null ? `${weather.humidity}%` : 'Unavailable'}
              </p>
              <p className="text-[10px] text-[#6B756A] mt-0.5">Relative humidity</p>
            </div>

            <div className="rounded-xl border border-[#E4E9E0] bg-white p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[#6B756A]">
                <Wind className="w-3.5 h-3.5 text-[#245C3A]" />
                <span>{t.windLabel}</span>
              </div>
              <p className="mt-2 font-mono text-base sm:text-lg font-bold text-[#202820] tabular-nums leading-tight">
                {weather.windSpeed !== null ? (
                  <>
                    {weather.windSpeed}{' '}
                    <span className="text-xs font-normal">
                      km/h {weather.windDirection || ''}
                    </span>
                  </>
                ) : weather.windSummary ? (
                  <span className="text-xs font-sans font-semibold">{weather.windSummary}</span>
                ) : (
                  'Unavailable'
                )}
              </p>
              <p className="text-[10px] text-[#6B756A] mt-0.5 truncate">
                {weather.windSummary || 'Surface wind'}
              </p>
            </div>

            <div className="rounded-xl border border-[#E4E9E0] bg-white p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[#6B756A]">
                <Sunrise className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {t.sunrise} / {t.sunset}
                </span>
              </div>
              {weather.sunrise || weather.sunset ? (
                <div className="mt-2 space-y-0.5">
                  <p className="font-mono text-xs font-bold text-[#202820] tabular-nums">
                    {weather.sunrise || '—'}
                  </p>
                  <p className="font-mono text-xs text-[#6B756A] tabular-nums flex items-center gap-1">
                    <Sunset className="w-3 h-3" /> {weather.sunset || '—'}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs font-medium text-[#6B756A]">Not reported</p>
              )}
              <p className="text-[10px] text-[#6B756A] mt-0.5">Local IST daylight</p>
            </div>
          </div>
        </div>

        {/* Grounded Source Links & Unavailable Fields Transparency */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF2EA] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#5B675B]">Sources:</span>
            {weather.groundedSources && weather.groundedSources.length > 0 ? (
              weather.groundedSources.slice(0, 4).map((src, idx) => (
                <a
                  key={`${src.url}-${idx}`}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F4] border border-[#E4E9E0] text-[11px] font-medium text-[#245C3A] hover:underline"
                >
                  <span className="max-w-[160px] truncate">{src.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ))
            ) : weather.primarySourceUrl ? (
              <a
                href={weather.primarySourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#245C3A] font-medium hover:underline"
              >
                <span>{weather.primarySourceName || 'Verified Weather Source'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-[#6B756A]">
                {weather.primarySourceName || 'Gemini Google Search Grounding'}
              </span>
            )}
          </div>

          {weather.unavailableFields && weather.unavailableFields.length > 0 && (
            <span className="text-[11px] text-[#6B756A]">
              Unavailable from source: {weather.unavailableFields.slice(0, 3).join(', ')}
            </span>
          )}
        </div>
      </section>

      {/* SEVEN-DAY WEATHER FORECAST SECTION (Graphs + 7 Compact Daily Cards) */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-[#245C3A]">
              <Calendar className="w-4 h-4" />
              <h2 className="text-lg sm:text-xl font-bold text-[#202820]">
                {t.sevenDayForecast}
              </h2>
            </div>
            <p className="text-xs text-[#6B756A] mt-0.5">
              Actual 7-day Indian calendar dates ({weather.forecast[0]?.shortDate} –{' '}
              {weather.forecast[weather.forecast.length - 1]?.shortDate}) · Click any day below for
              detailed conditions
            </p>
          </div>
          <span className="text-[11px] font-medium text-[#5B675B]">
            Hover or tap chart points for daily details
          </span>
        </div>

        {/* Temperature Line Graph + Separate Rain Probability Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Interactive 7-Day Temperature Graph */}
          <div className="lg:col-span-7 rounded-2xl border border-[#E4E9E0] bg-[#FAF9F4]/60 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-[#D97706]" />
                <h3 className="text-sm sm:text-base font-bold text-[#202820]">
                  7-Day Temperature Forecast (°C)
                </h3>
              </div>
              <span className="text-[11px] text-[#6B756A]">Max &amp; Min Daily °C</span>
            </div>

            {hasTempSeries ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{top: 22, right: 18, left: -12, bottom: 4}}
                    onClick={(state) => {
                      if (typeof state?.activeTooltipIndex === 'number') {
                        setSelectedDayIdx(state.activeTooltipIndex);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E0" vertical={false} />
                    <XAxis
                      dataKey="axisLabel"
                      tick={{fontSize: 11, fill: '#4B574B'}}
                      tickLine={false}
                    />
                    <YAxis
                      unit="°C"
                      domain={['dataMin - 3', 'dataMax + 3']}
                      tick={{fontSize: 11, fill: '#6B756A'}}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<TemperatureChartTooltip />} />
                    <Legend wrapperStyle={{fontSize: '12px', paddingTop: '6px'}} />
                    <Line
                      type="monotone"
                      dataKey="maxTemp"
                      name="Max Temp (°C)"
                      stroke="#D97706"
                      strokeWidth={2.5}
                      connectNulls={false}
                      dot={{r: 4, fill: '#D97706', strokeWidth: 2, stroke: '#FFFFFF'}}
                      activeDot={{r: 6}}
                    >
                      <LabelList
                        dataKey="maxTemp"
                        position="top"
                        offset={8}
                        formatter={(v: unknown) =>
                          typeof v === 'number' ? `${v}°` : ''
                        }
                        style={{fontSize: 11, fontWeight: 700, fill: '#B45309'}}
                      />
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="minTemp"
                      name="Min Temp (°C)"
                      stroke="#245C3A"
                      strokeWidth={2.5}
                      connectNulls={false}
                      dot={{r: 4, fill: '#245C3A', strokeWidth: 2, stroke: '#FFFFFF'}}
                      activeDot={{r: 6}}
                    >
                      <LabelList
                        dataKey="minTemp"
                        position="bottom"
                        offset={8}
                        formatter={(v: unknown) =>
                          typeof v === 'number' ? `${v}°` : ''
                        }
                        style={{fontSize: 11, fontWeight: 700, fill: '#1E4A2F'}}
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-xs text-[#6B756A]">
                7-day temperature series unavailable from current weather source.
              </div>
            )}
          </div>

          {/* Separate Rain Probability Bar Chart */}
          <div className="lg:col-span-5 rounded-2xl border border-[#E4E9E0] bg-[#FAF9F4]/60 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-[#5A91C8]" />
                <h3 className="text-sm sm:text-base font-bold text-[#202820]">
                  7-Day Rain Probability (%)
                </h3>
              </div>
              <span className="text-[11px] text-[#6B756A]">0% – 100%</span>
            </div>

            {hasRainProbSeries ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{top: 20, right: 10, left: -16, bottom: 4}}
                    onClick={(state) => {
                      if (typeof state?.activeTooltipIndex === 'number') {
                        setSelectedDayIdx(state.activeTooltipIndex);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E0" vertical={false} />
                    <XAxis
                      dataKey="axisLabel"
                      tick={{fontSize: 11, fill: '#4B574B'}}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{fontSize: 11, fill: '#6B756A'}}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<RainChartTooltip />} />
                    <Bar
                      dataKey="rainProbability"
                      name="Rain Probability (%)"
                      fill="#5A91C8"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={34}
                    >
                      <LabelList
                        dataKey="rainProbability"
                        position="top"
                        offset={6}
                        formatter={(v: unknown) =>
                          typeof v === 'number' ? `${v}%` : ''
                        }
                        style={{fontSize: 10, fontWeight: 600, fill: '#3B71A8'}}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-xs text-[#6B756A]">
                Rain probability forecast unavailable from current weather source.
              </div>
            )}
          </div>
        </div>

        {/* 7 Compact Daily Forecast Summary Cards with Weather Icons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {weather.forecast.slice(0, 7).map((day, idx) => {
            const active = safeDayIdx === idx;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDayIdx(idx)}
                className={`rounded-xl border p-3 text-left cursor-pointer transition-colors flex flex-col justify-between gap-2 ${
                  active
                    ? 'bg-[#EAF3E8] border-[#245C3A] ring-1 ring-[#245C3A]'
                    : 'bg-[#FAF9F4] border-[#E4E9E0] hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#202820] truncate">
                      {idx === 0 ? 'Today' : day.weekday}
                    </p>
                    <p className="text-[11px] text-[#6B756A]">{day.shortDate}</p>
                  </div>
                  <WeatherConditionIcon
                    condition={day.condition}
                    rainProbability={day.rainProbability}
                    className="w-5 h-5 shrink-0"
                  />
                </div>

                <p className="text-[11px] text-[#3C483C] line-clamp-2 min-h-[28px]">
                  {day.condition
                    ? t.weatherConditions[day.condition] || day.condition
                    : 'Unavailable'}
                </p>

                <div>
                  <p className="font-mono text-sm font-bold text-[#202820] tabular-nums">
                    {day.maxTemp !== null ? `${day.maxTemp}°` : '—'}{' '}
                    <span className="text-xs font-normal text-[#6B756A]">
                      / {day.minTemp !== null ? `${day.minTemp}°` : '—'}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] font-semibold text-[#3B71A8] tabular-nums">
                    Rain: {day.rainProbability !== null ? `${day.rainProbability}%` : '—'}
                    {day.rainfallMm !== null ? ` · ${day.rainfallMm}mm` : ''}
                  </p>
                  {day.warning && (
                    <p className="mt-1 text-[10px] font-semibold text-amber-800 flex items-center gap-1 truncate">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span className="truncate">{day.warning}</span>
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Day Interactive Detail Bar */}
        {selectedDay && (
          <div className="rounded-xl border border-[#D4DCD0] bg-[#FAF9F4] p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <WeatherConditionIcon
                  condition={selectedDay.condition}
                  rainProbability={selectedDay.rainProbability}
                  className="w-5 h-5"
                />
                <div>
                  <span className="font-bold text-[#202820]">
                    {selectedDay.dayLabel} ({selectedDay.date}):
                  </span>{' '}
                  <span className="text-[#3C483C]">
                    {selectedDay.condition
                      ? t.weatherConditions[selectedDay.condition] || selectedDay.condition
                      : 'Condition unavailable'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-4 font-mono text-xs text-[#202820] tabular-nums">
                <span>
                  Max: {selectedDay.maxTemp !== null ? `${selectedDay.maxTemp}°C` : 'Unavailable'}
                </span>
                <span>
                  Min: {selectedDay.minTemp !== null ? `${selectedDay.minTemp}°C` : 'Unavailable'}
                </span>
                <span>
                  Rain Prob:{' '}
                  {selectedDay.rainProbability !== null
                    ? `${selectedDay.rainProbability}%`
                    : 'Unavailable'}
                </span>
                {selectedDay.rainfallMm !== null && (
                  <span>Expected Rain: {selectedDay.rainfallMm} mm</span>
                )}
                {selectedDay.humidity !== null && <span>Humidity: {selectedDay.humidity}%</span>}
              </div>
            </div>
            {selectedDay.warning && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Weather Warning:</strong> {selectedDay.warning}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Alerts & Farm Weather Advisories */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border border-[#E4E9E0] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#245C3A]" />
              <h2 className="text-lg font-bold text-[#202820]">{t.weatherAlertsTitle}</h2>
            </div>
            <span className="font-mono text-xs font-semibold text-[#245C3A] bg-[#EAF3E8] px-2 py-0.5 rounded-md">
              {visibleAlerts.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {visibleAlerts.map((alert) => {
              const badge = getSourceBadge(alert.sourceType);
              return (
                <div
                  key={alert.id}
                  className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3.5 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#202820]">{alert.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${badge.className}`}
                      >
                        {badge.label}
                      </span>
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
                  </div>
                  <p className="text-xs text-[#6B756A]">{alert.summary}</p>
                  <p className="text-xs font-medium text-[#245C3A]">{alert.action}</p>
                  {alert.sourceUrl && (
                    <a
                      href={alert.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#245C3A] hover:underline pt-0.5"
                    >
                      <span>{alert.sourceName || 'View Official Bulletin'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-[#245C3A]" />
              <h2 className="text-lg font-bold text-[#202820]">{t.farmWeatherAdvisoryTitle}</h2>
            </div>
            <span className="font-mono text-xs text-[#6B756A]">
              {weather.advisories.length} active
            </span>
          </div>
          <div className="space-y-3">
            {weather.advisories.map((adv) => {
              const badge = getSourceBadge(adv.sourceType);
              return (
                <div
                  key={adv.id}
                  className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-4 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#202820]">{adv.recommendation}</p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="font-mono text-xs text-[#245C3A] font-semibold">
                        {adv.timeWindow}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#6B756A]">
                    <strong className="text-[#202820]">Condition:</strong> {adv.condition}
                  </p>
                  <p className="text-xs text-[#6B756A]">{adv.reason}</p>
                  {adv.relatedCropIds && adv.relatedCropIds.length > 0 && (
                    <p className="text-[11px] font-medium text-[#245C3A]">
                      Tailored for:{' '}
                      {adv.relatedCropIds.map((id) => t.cropNames[id] || id).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[#6B756A] pt-1">{t.advisoryDisclaimer}</p>
        </div>
      </section>
    </div>
  );
}
