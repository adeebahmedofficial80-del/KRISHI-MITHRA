import {
  ArrowRight,
  ArrowUpRight,
  CloudSun,
  MapPin,
  ShieldAlert,
  Sprout,
  Store,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {Line, LineChart, ResponsiveContainer} from 'recharts';
import {TranslationPack} from '../data/translations';
import {marketProvider} from '../services/marketProvider';
import {
  CropProduct,
  LanguageCode,
  LocationOption,
  NavTab,
  PriceAlert,
  WeatherSnapshot,
} from '../types/krishi';
import {CropImage} from './CropImage';

interface HomeDashboardProps {
  t: TranslationPack;
  language: LanguageCode;
  location: LocationOption;
  weather: WeatherSnapshot | null;
  weatherLoading: boolean;
  favoriteCropIds: string[];
  priceAlerts: PriceAlert[];
  onNavigate: (tab: NavTab) => void;
  onOpenCropDetail: (cropId: string) => void;
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

const PULSE_IDS = ['tomato', 'onion', 'potato', 'banana'];

export function HomeDashboard({
  t,
  language,
  location,
  weather,
  weatherLoading,
  favoriteCropIds,
  priceAlerts,
  onNavigate,
  onOpenCropDetail,
  audioActiveKey,
  audioLoadingKey,
  onListen,
}: HomeDashboardProps) {
  const allProducts = useMemo(() => marketProvider.getAllProducts(), []);
  const pulseProducts = useMemo(
    () =>
      PULSE_IDS.map((id) => allProducts.find((c) => c.id === id)).filter(
        (c): c is CropProduct => Boolean(c),
      ),
    [allProducts],
  );

  const [compareCropId, setCompareCropId] = useState<string>('tomato');
  const compareSummary = useMemo(
    () => marketProvider.getMarketComparison(compareCropId, location),
    [compareCropId, location],
  );

  const monitoredCrops = useMemo(
    () =>
      favoriteCropIds
        .map((id) => allProducts.find((c) => c.id === id))
        .filter((c): c is CropProduct => Boolean(c)),
    [allProducts, favoriteCropIds],
  );

  const recentMovers = useMemo(
    () =>
      [...allProducts]
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, 5),
    [allProducts],
  );

  const rainProb = weather?.rainProbability ?? 20;
  const rainSummaryText =
    rainProb >= 60 ? t.highRainChance : rainProb >= 35 ? t.moderateRainChance : t.lowRainChance;

  const audioKey = 'home-briefing';
  const isPlaying = audioActiveKey === audioKey;
  const isAudioLoading = audioLoadingKey === audioKey;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245C3A]">
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {location.name}, {location.state}
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#202820] tracking-tight">
            {t.goodMorning}
          </h1>
          <p className="mt-1 text-sm text-[#6B756A]">{t.welcomeSub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isAudioLoading}
            onClick={() =>
              onListen({
                key: audioKey,
                text: `Good morning. In ${location.name}, current temperature is ${weather?.currentTemperature ?? 26} degrees Celsius with ${rainProb} percent rain probability. Tomato modal price is 22 rupees per kg, Onion is 45 rupees per kg, Potato is 24 rupees per kg, and Banana is 35 rupees per kg.`,
                language,
                quickSummarizeTopic: 'Morning market and weather briefing',
                quickSummarizePayload: {
                  location: location.name,
                  temperatureC: weather?.currentTemperature ?? 26,
                  rainChancePercent: rainProb,
                  keyPricesInrPerKg: {Tomato: 22, Onion: 45, Potato: 24, Banana: 35},
                  topAdvisory: weather?.advisories?.[0]?.recommendation,
                },
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm font-semibold text-[#202820] hover:bg-[#EAF3E8] cursor-pointer min-h-[44px]"
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
            onClick={() => onNavigate('markets')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] transition-colors cursor-pointer min-h-[44px]"
          >
            <span>{t.viewAllPrices}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 4 Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('markets')}
          className="bg-white border border-[#E4E9E0] rounded-2xl p-4 text-left hover:border-[#245C3A] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
              {t.marketPricesCardTitle}
            </span>
            <Store className="w-4 h-4 text-[#245C3A]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#202820] tabular-nums">
            {t.pricesAvailable}
          </p>
          <p className="mt-1 text-xs text-[#6B756A]">{t.marketPricesCardSub}</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('weather')}
          className="bg-white border border-[#E4E9E0] rounded-2xl p-4 text-left hover:border-[#245C3A] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
              {t.todaysWeather}
            </span>
            <CloudSun className="w-4 h-4 text-[#5A91C8]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#202820] tabular-nums">
            {weatherLoading && !weather ? '—' : `${weather?.currentTemperature ?? 26}°C`}
          </p>
          <p className="mt-1 text-xs text-[#6B756A] tabular-nums">
            {rainSummaryText} · {rainProb}%
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('weather')}
          className="bg-white border border-[#E4E9E0] rounded-2xl p-4 text-left hover:border-[#245C3A] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
              {t.farmAdvisory}
            </span>
            <ShieldAlert className="w-4 h-4 text-[#245C3A]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#202820] tabular-nums">
            {weather?.advisories?.length ?? 3} {t.updatesCount}
          </p>
          <p className="mt-1 text-xs text-[#6B756A] truncate">
            {weather?.advisories?.[0]?.recommendation || t.checkRecommendations}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('my-crops')}
          className="bg-white border border-[#E4E9E0] rounded-2xl p-4 text-left hover:border-[#245C3A] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
              {t.navMyCrops}
            </span>
            <Sprout className="w-4 h-4 text-[#245C3A]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#202820] tabular-nums">
            {favoriteCropIds.length} saved
          </p>
          <p className="mt-1 text-xs text-[#6B756A] tabular-nums">
            {priceAlerts.filter((a) => a.enabled).length} active price alerts
          </p>
        </button>
      </section>

      {/* Today's Market Pulse */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#202820]">{t.todaysMarketPulse}</h2>
            <p className="text-xs text-[#6B756A]">{t.demoBannerPrefix}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('markets')}
            className="text-sm font-semibold text-[#245C3A] hover:underline cursor-pointer"
          >
            {t.viewAllPrices}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pulseProducts.map((crop) => {
            const name = t.cropNames[crop.id] || crop.name;
            const positive = crop.priceChangePercent >= 0;
            return (
              <button
                key={crop.id}
                type="button"
                onClick={() => onOpenCropDetail(crop.id)}
                className="bg-white border border-[#E4E9E0] rounded-2xl p-4 text-left hover:border-[#245C3A] transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center gap-3">
                  <CropImage
                    src={crop.image}
                    alt={name}
                    className="w-12 h-12 rounded-xl border border-[#E4E9E0] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#202820] truncate">{name}</p>
                    <p className="text-xs text-[#6B756A] truncate">
                      {t.marketNames[crop.marketId] || crop.market}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="font-mono text-2xl font-bold text-[#202820] tabular-nums">
                      ₹{crop.modalPrice}
                      <span className="text-xs font-normal text-[#6B756A]">/kg</span>
                    </p>
                    <p
                      className={`font-mono text-xs font-semibold tabular-nums flex items-center gap-0.5 ${
                        positive ? 'text-[#245C3A]' : 'text-amber-700'
                      }`}
                    >
                      <ArrowUpRight className={`w-3.5 h-3.5 ${!positive ? 'rotate-90' : ''}`} />
                      <span>
                        {positive ? '+' : ''}
                        {crop.priceChangePercent}%
                      </span>
                    </p>
                  </div>

                  <div className="w-20 h-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={crop.priceHistory['7d']}>
                        <Line
                          type="monotone"
                          dataKey="modal"
                          stroke={positive ? '#245C3A' : '#B45309'}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Compare Nearby Markets + Weather Preview Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Nearby Markets Quick Widget */}
        <div className="lg:col-span-6 bg-white border border-[#E4E9E0] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#202820]">{t.compareNearbyMarkets}</h2>
              <select
                aria-label="Choose crop to compare markets"
                value={compareCropId}
                onChange={(e) => setCompareCropId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm font-medium text-[#202820]"
              >
                {allProducts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t.cropNames[c.id] || c.name}
                  </option>
                ))}
              </select>
            </div>

            {compareSummary && (
              <div className="mt-4 space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#E4E9E0] bg-[#EAF3E8]/50 p-3">
                    <p className="text-xs text-[#245C3A] font-medium">{t.bestPrice}</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[#202820] tabular-nums">
                      ₹{compareSummary.highest.modalPrice}/kg
                    </p>
                    <p className="text-xs text-[#6B756A] truncate">
                      {t.marketNames[compareSummary.highest.marketId] ||
                        compareSummary.highest.marketName}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3">
                    <p className="text-xs text-[#6B756A]">{t.priceDifference}</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[#245C3A] tabular-nums">
                      ₹{compareSummary.spread}/kg
                    </p>
                    <p className="text-xs text-[#6B756A]">
                      vs {compareSummary.lowest.marketName}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E4E9E0]">
            <p className="text-xs text-[#6B756A]">{t.transportCostNote}</p>
            <button
              type="button"
              onClick={() => onOpenCropDetail(compareCropId)}
              className="px-3.5 py-2 rounded-xl bg-[#245C3A] text-white text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-[#1d4b2f]"
            >
              {t.compareMarketsBtn}
            </button>
          </div>
        </div>

        {/* 7-Day Weather Preview */}
        <div className="lg:col-span-6 bg-white border border-[#E4E9E0] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#202820]">{t.sevenDayForecast}</h2>
              <p className="text-xs text-[#6B756A]">
                {weather?.locationName || location.name} ·{' '}
                {weather?.sourceLabel || 'Loading weather...'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('weather')}
              className="text-xs font-semibold text-[#245C3A] hover:underline cursor-pointer"
            >
              {t.viewFullForecast}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
            {(weather?.forecast ?? []).slice(0, 7).map((day) => (
              <div
                key={day.date}
                className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-2 text-center"
              >
                <p className="text-[11px] font-semibold text-[#6B756A] truncate">
                  {day.dayLabel}
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-[#202820] tabular-nums">
                  {day.maxTemp}°
                </p>
                <p className="font-mono text-[11px] text-[#6B756A] tabular-nums">{day.minTemp}°</p>
                <p className="mt-1 font-mono text-[10px] font-semibold text-[#5A91C8] tabular-nums">
                  {day.rainProbability}%
                </p>
              </div>
            ))}
          </div>

          {weather?.advisories?.[0] && (
            <div className="rounded-xl border border-[#E4E9E0] bg-[#EAF3E8]/40 px-3.5 py-2.5 text-xs text-[#202820]">
              <span className="font-semibold text-[#245C3A]">Tip: </span>
              {weather.advisories[0].recommendation}
            </div>
          )}
        </div>
      </section>

      {/* Monitored Crops + Recent Updates */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-[#E4E9E0] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#202820]">{t.myMonitoredCrops}</h2>
            <button
              type="button"
              onClick={() => onNavigate('my-crops')}
              className="text-xs font-semibold text-[#245C3A] hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>
          {monitoredCrops.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-[#6B756A]">{t.noCropsTitle}</p>
              <button
                type="button"
                onClick={() => onNavigate('markets')}
                className="mt-3 px-4 py-2 rounded-xl bg-[#245C3A] text-white text-xs font-semibold cursor-pointer"
              >
                {t.noCropsAction}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {monitoredCrops.map((crop) => (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => onOpenCropDetail(crop.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] hover:border-[#245C3A] text-left cursor-pointer"
                >
                  <CropImage
                    src={crop.image}
                    alt={t.cropNames[crop.id] || crop.name}
                    className="w-11 h-11 rounded-xl border border-[#E4E9E0] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#202820] truncate">
                      {t.cropNames[crop.id] || crop.name}
                    </p>
                    <p className="text-xs text-[#6B756A] truncate">
                      {t.marketNames[crop.marketId] || crop.market}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-[#202820] tabular-nums">
                      ₹{crop.modalPrice}/kg
                    </p>
                    <p
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        crop.priceChangePercent >= 0 ? 'text-[#245C3A]' : 'text-amber-700'
                      }`}
                    >
                      {crop.priceChangePercent >= 0 ? '+' : ''}
                      {crop.priceChangePercent}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E4E9E0] rounded-2xl p-5">
          <h2 className="text-lg font-bold text-[#202820] mb-3">{t.recentUpdates}</h2>
          <div className="divide-y divide-[#E4E9E0]">
            {recentMovers.map((crop) => (
              <button
                key={crop.id}
                type="button"
                onClick={() => onOpenCropDetail(crop.id)}
                className="w-full py-2.5 flex items-center justify-between text-left hover:bg-[#FAF9F4] px-2 -mx-2 rounded-lg cursor-pointer"
              >
                <div>
                  <p className="text-sm font-semibold text-[#202820]">
                    {t.cropNames[crop.id] || crop.name}
                  </p>
                  <p className="text-xs text-[#6B756A]">
                    {t.marketNames[crop.marketId] || crop.market}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-[#202820] tabular-nums">
                    ₹{crop.modalPrice}/kg
                  </p>
                  <p
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      crop.priceChangePercent >= 0 ? 'text-[#245C3A]' : 'text-amber-700'
                    }`}
                  >
                    {crop.priceChangePercent >= 0 ? '+' : ''}
                    {crop.priceChangePercent}%
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
