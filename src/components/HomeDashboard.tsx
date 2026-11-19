import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Info,
  Loader2,
  MapPin,
  Pause,
  RefreshCw,
  ShieldAlert,
  Sprout,
  Store,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {Line, LineChart, ResponsiveContainer} from 'recharts';
import {getTimeBasedGreeting, TranslationPack} from '../data/translations';
import {AudioPlaybackStatus} from '../hooks/useAudioPlayer';
import {
  getMarketComparisonForProduct,
  UNAVAILABLE_PRICE_MESSAGE,
} from '../services/marketProvider';
import {
  CropProduct,
  DailyBriefingResponse,
  FarmerProfile,
  LanguageCode,
  LocationOption,
  MarketSyncStatus,
  NavTab,
  PriceAlert,
  WeatherSnapshot,
} from '../types/krishi';
import {BriefingPlayerBar} from './BriefingPlayerBar';
import {CropImage} from './CropImage';
import {PlantingCalendar} from './PlantingCalendar';

interface HomeDashboardProps {
  t: TranslationPack;
  language: LanguageCode;
  farmerName: string;
  farmerProfile: FarmerProfile | null;
  isReturningUserSession: boolean;
  onDismissReturningWelcome: () => void;
  location: LocationOption;
  products: CropProduct[];
  marketStatus: MarketSyncStatus;
  marketSyncing: boolean;
  fetchingCropId: string | null;
  onRefreshMarket: () => void;
  onFetchCropPrice: (cropId: string) => void;
  weather: WeatherSnapshot | null;
  weatherLoading: boolean;
  weatherError: string | null;
  onRetryWeather: () => void;
  favoriteCropIds: string[];
  priceAlerts: PriceAlert[];
  onNavigate: (tab: NavTab) => void;
  onOpenCropDetail: (cropId: string) => void;
  briefingStatus: AudioPlaybackStatus;
  briefingLoading: boolean;
  briefingData: DailyBriefingResponse | null;
  briefingError: string | null;
  onPlayDailyBriefing: (forceRefresh?: boolean) => void;
  onPauseAudio: () => void;
  onResumeAudio: () => void;
  onStopAudio: () => void;
  onDismissBriefing: () => void;
}

export function HomeDashboard({
  t,
  language,
  farmerName,
  farmerProfile,
  isReturningUserSession,
  onDismissReturningWelcome,
  location,
  products,
  marketStatus,
  marketSyncing,
  fetchingCropId,
  onRefreshMarket,
  onFetchCropPrice,
  weather,
  weatherLoading,
  weatherError,
  onRetryWeather,
  favoriteCropIds,
  priceAlerts,
  onNavigate,
  onOpenCropDetail,
  briefingStatus,
  briefingLoading,
  briefingData,
  briefingError,
  onPlayDailyBriefing,
  onPauseAudio,
  onResumeAudio,
  onStopAudio,
  onDismissBriefing,
}: HomeDashboardProps) {
  const monitoredCrops = useMemo(
    () =>
      favoriteCropIds
        .map((id) => products.find((c) => c.id === id))
        .filter((c): c is CropProduct => Boolean(c)),
    [products, favoriteCropIds],
  );

  const [compareCropId, setCompareCropId] = useState<string>(
    favoriteCropIds[0] || products[0]?.id || 'tomato',
  );

  const effectiveCompareCrop = useMemo(
    () => products.find((c) => c.id === compareCropId) || monitoredCrops[0] || products[0],
    [products, compareCropId, monitoredCrops],
  );

  const compareSummary = useMemo(
    () => getMarketComparisonForProduct(effectiveCompareCrop, location),
    [effectiveCompareCrop, location],
  );

  // Regional market highlights — prioritize verified Gemini-grounded crops, else staple slots
  const regionalHighlights = useMemo(() => {
    const verifiedCrops = products.filter((p) => p.hasVerifiedPrice);
    if (verifiedCrops.length >= 4) {
      return verifiedCrops.slice(0, 4);
    }
    const stapleIds = ['tomato', 'onion', 'potato', 'banana'];
    const result = [...verifiedCrops];
    for (const id of stapleIds) {
      if (result.length >= 4) break;
      const found = products.find((p) => p.id === id);
      if (found && !result.some((r) => r.id === found.id)) {
        result.push(found);
      }
    }
    return result;
  }, [products]);

  const greeting = getTimeBasedGreeting(language, farmerName);
  const localityLine = [
    farmerProfile?.taluk,
    location.district,
    location.state,
  ]
    .filter(Boolean)
    .join(', ');

  const activeWeatherWarning = useMemo(() => {
    if (!weather?.alerts?.length) return null;
    return (
      weather.alerts.find(
        (a) =>
          a.sourceType === 'official_imd' ||
          a.sourceType === 'official_grounded' ||
          a.severity === 'High',
      ) || null
    );
  }, [weather]);

  const renderCompactWeatherIcon = (condition?: string | null, rainProbVal?: number | null) => {
    const c = (condition || '').toLowerCase();
    if (c.includes('thunder') || c.includes('storm') || c.includes('lightning')) {
      return <CloudLightning className="w-4 h-4 text-amber-600 mx-auto" />;
    }
    if (c.includes('rain') || c.includes('shower') || c.includes('drizzle') || (rainProbVal !== null && rainProbVal !== undefined && rainProbVal >= 60)) {
      return <CloudRain className="w-4 h-4 text-[#5A91C8] mx-auto" />;
    }
    if (c.includes('fog') || c.includes('mist') || c.includes('haze')) {
      return <CloudFog className="w-4 h-4 text-[#6B756A] mx-auto" />;
    }
    if (c.includes('overcast') || c === 'cloudy') {
      return <Cloud className="w-4 h-4 text-[#6B756A] mx-auto" />;
    }
    if (c.includes('sun') || c.includes('clear')) {
      return <Sun className="w-4 h-4 text-amber-500 mx-auto" />;
    }
    return <CloudSun className="w-4 h-4 text-[#245C3A] mx-auto" />;
  };

  const advisoryCount = weather?.advisories?.length ?? 0;
  const activeAlertsCount = priceAlerts.filter((a) => a.enabled).length;
  const trackedCount = monitoredCrops.length;

  return (
    <div className="space-y-6">
      {/* Returning User Concise Welcome Banner */}
      {isReturningUserSession && (
        <div className="bg-[#EAF3E8] border border-[#CBE0C6] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm font-medium text-[#1E4A2F]">
            Welcome back, <span className="font-bold">{farmerName}</span>! Your saved location (
            {localityLine}) and {trackedCount} tracked {trackedCount === 1 ? 'crop' : 'crops'} are
            loaded.
          </p>
          <button
            type="button"
            onClick={onDismissReturningWelcome}
            aria-label="Dismiss welcome message"
            className="p-1 rounded-lg text-[#245C3A] hover:bg-white/60 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Personalized Welcome Banner + Gemini Listen CTA */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#245C3A]">
            <MapPin className="w-3.5 h-3.5" />
            <span>{localityLine}</span>
            {farmerProfile?.preferredMandi && (
              <>
                <span className="text-[#94A393]">·</span>
                <span className="text-[#5B675B]">Mandi: {farmerProfile.preferredMandi}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#202820] tracking-tight">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-[#6B756A]">{t.welcomeSub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={briefingLoading}
            onClick={() => onPlayDailyBriefing(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#245C3A]/30 bg-[#EAF3E8] text-sm font-semibold text-[#1E4A2F] hover:bg-[#DCECD8] disabled:opacity-70 cursor-pointer min-h-[44px] transition-colors"
          >
            {briefingLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#245C3A]" />
            ) : briefingStatus === 'playing' ? (
              <Pause className="w-4 h-4 text-[#245C3A]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#245C3A]" />
            )}
            <span>
              {briefingLoading
                ? 'Preparing your morning update...'
                : briefingStatus === 'playing'
                  ? 'Pause Briefing'
                  : briefingStatus === 'paused'
                    ? 'Resume Briefing'
                    : t.listenSummary}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('markets')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] transition-colors cursor-pointer min-h-[44px]"
          >
            <span>Explore Marketplace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Personalized Gemini Daily Briefing Player & Transcript */}
      <BriefingPlayerBar
        status={briefingStatus}
        isLoading={briefingLoading}
        briefing={briefingData}
        error={briefingError}
        onPlayOrToggle={() => onPlayDailyBriefing(false)}
        onRefresh={() => onPlayDailyBriefing(true)}
        onPause={onPauseAudio}
        onResume={onResumeAudio}
        onStop={onStopAudio}
        onDismiss={() => {
          onStopAudio();
          onDismissBriefing();
        }}
      />

      {/* 4 Live Dynamic Summary Cards (Zero Hardcoded Counts or Fake Weather) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Market Prices (Personal Tracked Count) */}
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
            {trackedCount} {trackedCount === 1 ? 'crop' : 'crops'} tracked
          </p>
          <p className="mt-1 text-xs text-[#6B756A]">
            {trackedCount === 0
              ? 'Start selecting the crops you want to monitor.'
              : `${products.length} vegetables & fruits available in Marketplace`}
          </p>
        </button>

        {/* Card 2: Today's Real Weather (Gemini Google Search Grounded) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('weather')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('weather');
            }
          }}
          className="bg-white border border-[#E4E9E0] rounded-2xl p-4 text-left hover:border-[#245C3A] transition-colors cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
              {t.todaysWeather}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={weatherLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetryWeather();
                }}
                aria-label="Refresh weather"
                title="Refresh weather"
                className="p-1 rounded-lg text-[#6B756A] hover:text-[#245C3A] hover:bg-[#EAF3E8] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
              </button>
              <CloudSun className="w-4 h-4 text-[#5A91C8]" />
            </div>
          </div>

          {weatherLoading && !weather ? (
            <div className="mt-2 space-y-1">
              <p className="font-mono text-xl font-bold text-[#6B756A] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#245C3A]" />
                <span>Searching...</span>
              </p>
              <p className="text-xs text-[#6B756A]">Retrieving live weather via Gemini Search</p>
            </div>
          ) : weather ? (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-2xl font-bold text-[#202820] tabular-nums">
                  {weather.currentTemperature !== null
                    ? `${weather.currentTemperature}°C`
                    : 'Unavailable'}
                </p>
                {(weather.todayMinTemp !== null || weather.todayMaxTemp !== null) && (
                  <span className="font-mono text-[11px] font-medium text-[#5B675B] tabular-nums">
                    Forecast:{' '}
                    {weather.todayMinTemp !== null ? `${weather.todayMinTemp}°` : '—'}–
                    {weather.todayMaxTemp !== null ? `${weather.todayMaxTemp}°C` : '—'}
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold text-[#245C3A] truncate">
                {weather.condition || weather.todayForecastCondition || 'Condition unavailable'}
              </p>

              <p className="text-[11px] text-[#3C483C] tabular-nums">
                Rain Probability:{' '}
                <span className="font-mono font-semibold">
                  {weather.rainProbability !== null ? `${weather.rainProbability}%` : 'Unavailable'}
                </span>{' '}
                · Humidity:{' '}
                <span className="font-mono font-semibold">
                  {weather.humidity !== null ? `${weather.humidity}%` : 'Unavailable'}
                </span>
              </p>

              {activeWeatherWarning && (
                <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1 truncate">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="truncate">{activeWeatherWarning.title}</span>
                </p>
              )}

              <p className="text-[10px] text-[#6B756A] truncate pt-0.5">
                {weather.isStale ? 'Cached · ' : ''}
                {weather.updatedAt}
                {weather.primarySourceName ? ` · ${weather.primarySourceName}` : ''}
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              <p className="text-base font-bold text-amber-800">Weather Unavailable</p>
              <p className="text-xs text-[#6B756A] line-clamp-2">
                {weatherError || 'Tap refresh to retrieve live weather via Gemini Search.'}
              </p>
            </div>
          )}
        </div>

        {/* Card 3: Real Farm Advisory Count */}
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
            {weatherLoading && !weather ? '—' : `${advisoryCount} ${t.updatesCount}`}
          </p>
          <p className="mt-1 text-xs text-[#6B756A] truncate">
            {weather?.advisories?.[0]?.recommendation ||
              (weatherError ? 'Waiting for live weather data' : t.checkRecommendations)}
          </p>
        </button>

        {/* Card 4: My Crops Saved */}
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
            {trackedCount} saved
          </p>
          <p className="mt-1 text-xs text-[#6B756A] tabular-nums">
            {activeAlertsCount} active price {activeAlertsCount === 1 ? 'alert' : 'alerts'}
          </p>
        </button>
      </section>

      {/* Personal Monitored Crops Section (Strictly User's Selected Crops) */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#202820]">{t.myMonitoredCrops}</h2>
            <p className="text-xs text-[#6B756A]">
              {trackedCount === 0
                ? 'Your personal watchlist starts empty so you track only the crops you grow.'
                : `Monitoring ${trackedCount} selected ${trackedCount === 1 ? 'crop' : 'crops'} in ${localityLine}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(trackedCount === 0 ? 'markets' : 'my-crops')}
            className="text-xs font-semibold text-[#245C3A] hover:underline cursor-pointer"
          >
            {trackedCount === 0 ? 'Add Crops' : 'Manage My Crops'}
          </button>
        </div>

        {monitoredCrops.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CFD9C8] bg-[#F7F9F4] py-8 px-4 text-center">
            <Sprout className="w-8 h-8 text-[#245C3A] mx-auto" />
            <p className="mt-2 text-base font-semibold text-[#202820]">
              0 crops tracked yet
            </p>
            <p className="mt-1 text-xs sm:text-sm text-[#6B756A] max-w-md mx-auto">
              Start selecting the vegetables and fruits you grow from our {products.length}-crop
              Indian Marketplace to see personalized rates, alerts, and crop-specific advisories.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#1D4B2F] cursor-pointer"
            >
              <span>Browse {products.length} Vegetables & Fruits</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monitoredCrops.map((crop) => {
              const name = t.cropNames[crop.id] || crop.name;
              const positive = crop.priceChangePercent >= 0;
              return (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => onOpenCropDetail(crop.id)}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] hover:border-[#245C3A] text-left cursor-pointer transition-colors"
                >
                  <CropImage
                    src={crop.image}
                    alt={name}
                    category={crop.category}
                    className="w-12 h-12 rounded-xl border border-[#E4E9E0] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#202820] truncate">{name}</p>
                    <p className="text-xs text-[#6B756A] truncate">
                      {crop.hasVerifiedPrice
                        ? t.marketNames[crop.marketId] || crop.market
                        : UNAVAILABLE_PRICE_MESSAGE}
                    </p>
                    {crop.hasVerifiedPrice && (
                      <p className="text-[11px] text-[#6B756A] truncate">
                        {crop.observationDate || crop.updatedAt}
                        {crop.sourceName ? ` · ${crop.sourceName}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {crop.hasVerifiedPrice ? (
                      <>
                        <p className="font-mono text-base font-bold text-[#202820] tabular-nums">
                          ₹{crop.modalPrice}/kg
                        </p>
                        {crop.hasComparableHistory ? (
                          <p
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              positive ? 'text-[#245C3A]' : 'text-amber-700'
                            }`}
                          >
                            {positive ? '+' : ''}
                            {crop.priceChangePercent}%
                          </p>
                        ) : (
                          <p className="font-mono text-[11px] text-[#6B756A] tabular-nums">
                            ₹{crop.modalPriceQuintal ?? Math.round(crop.modalPrice * 100)}/qtl
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#245C3A]">
                        Fetch Live →
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Interactive 12-Month Planting & Harvesting Calendar with Weather Readiness */}
      <PlantingCalendar
        savedCrops={monitoredCrops}
        allProducts={products}
        weather={weather}
        location={location}
        onOpenCropDetail={onOpenCropDetail}
        onNavigate={onNavigate}
      />

      {/* Regional Market Overview (Gemini Google Search Grounding) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#202820]">
              Regional Market Snapshot
            </h2>
            <p className="text-xs text-[#6B756A] flex items-center gap-1.5 mt-0.5">
              <Info className="w-3.5 h-3.5 text-[#245C3A]" />
              <span>
                {marketStatus.sourceLabel}
                {marketStatus.observationDate ? ` · ${marketStatus.observationDate}` : ''}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {marketStatus.geminiSearchEnabled && (
              <button
                type="button"
                disabled={marketSyncing}
                onClick={onRefreshMarket}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#245C3A]/30 bg-[#EAF3E8] hover:bg-[#DCECD8] text-xs font-semibold text-[#1E4A2F] cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${marketSyncing ? 'animate-spin' : ''}`} />
                <span>{marketSyncing ? 'Searching Online...' : 'Fetch Live Prices'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="text-sm font-semibold text-[#245C3A] hover:underline cursor-pointer"
            >
              {t.viewAllPrices}
            </button>
          </div>
        </div>

        {marketStatus.staleReason && (
          <div className="rounded-xl bg-[#FDF6EB] border border-[#EBD5B3] px-3.5 py-2.5 text-xs text-[#7D4E10] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{marketStatus.staleReason}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {regionalHighlights.map((crop) => {
            const name = t.cropNames[crop.id] || crop.name;
            const positive = crop.priceChangePercent >= 0;
            const isFetchingThis = fetchingCropId === crop.id;
            return (
              <div
                key={crop.id}
                className="bg-white border border-[#E4E9E0] rounded-2xl p-4 text-left hover:border-[#245C3A] transition-colors flex flex-col justify-between"
              >
                <button
                  type="button"
                  onClick={() => onOpenCropDetail(crop.id)}
                  className="flex items-center gap-3 text-left cursor-pointer"
                >
                  <CropImage
                    src={crop.image}
                    alt={name}
                    category={crop.category}
                    className="w-12 h-12 rounded-xl border border-[#E4E9E0] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#202820] truncate">{name}</p>
                    <p className="text-xs text-[#6B756A] truncate">
                      {crop.hasVerifiedPrice
                        ? t.marketNames[crop.marketId] || crop.market
                        : `${location.district} APMC`}
                    </p>
                  </div>
                </button>

                {crop.hasVerifiedPrice ? (
                  <button
                    type="button"
                    onClick={() => onOpenCropDetail(crop.id)}
                    className="mt-3 flex items-end justify-between gap-2 text-left cursor-pointer"
                  >
                    <div>
                      <p className="font-mono text-2xl font-bold text-[#202820] tabular-nums">
                        ₹{crop.modalPrice}
                        <span className="text-xs font-normal text-[#6B756A]">/kg</span>
                      </p>
                      {crop.hasComparableHistory ? (
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
                      ) : (
                        <p className="text-[11px] text-[#6B756A] truncate max-w-[140px]">
                          {crop.observationDate || crop.updatedAt}
                        </p>
                      )}
                    </div>

                    {crop.priceHistory['7d'].length >= 2 && (
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
                    )}
                  </button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-[#6B756A] leading-snug">
                      {UNAVAILABLE_PRICE_MESSAGE}
                    </p>
                    <button
                      type="button"
                      disabled={isFetchingThis || marketSyncing}
                      onClick={() => onFetchCropPrice(crop.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245C3A] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingThis ? 'animate-spin' : ''}`} />
                      <span>{isFetchingThis ? 'Searching online...' : 'Fetch Live Price'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Compare Nearby Markets + 7-Day Weather Preview Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Nearby Markets Quick Widget */}
        <div className="lg:col-span-6 bg-white border border-[#E4E9E0] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#202820]">{t.compareNearbyMarkets}</h2>
              <select
                aria-label="Choose crop to compare markets"
                value={effectiveCompareCrop?.id || ''}
                onChange={(e) => setCompareCropId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm font-medium text-[#202820]"
              >
                {products.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t.cropNames[c.id] || c.name}
                  </option>
                ))}
              </select>
            </div>

            {compareSummary ? (
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
                    <p className="text-xs text-[#6B756A] truncate">
                      vs {compareSummary.lowest.marketName}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#D3DDD0] bg-[#FAF9F4] p-4 text-center space-y-2">
                <p className="text-xs text-[#5A6B5F]">{UNAVAILABLE_PRICE_MESSAGE}</p>
                {effectiveCompareCrop && (
                  <button
                    type="button"
                    disabled={fetchingCropId === effectiveCompareCrop.id}
                    onClick={() => onFetchCropPrice(effectiveCompareCrop.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF3E8] px-3 py-1.5 text-xs font-semibold text-[#1E4A2F] hover:bg-[#DCECD8] cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        fetchingCropId === effectiveCompareCrop.id ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {fetchingCropId === effectiveCompareCrop.id
                        ? 'Checking live mandis...'
                        : `Fetch Live ${effectiveCompareCrop.name} Rates`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E4E9E0]">
            <p className="text-xs text-[#6B756A]">{t.transportCostNote}</p>
            {effectiveCompareCrop && (
              <button
                type="button"
                onClick={() => onOpenCropDetail(effectiveCompareCrop.id)}
                className="px-3.5 py-2 rounded-xl bg-[#245C3A] text-white text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-[#1d4b2f]"
              >
                {t.compareMarketsBtn}
              </button>
            )}
          </div>
        </div>

        {/* 7-Day Weather Preview */}
        <div className="lg:col-span-6 bg-white border border-[#E4E9E0] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#202820]">{t.sevenDayForecast}</h2>
              <p className="text-xs text-[#6B756A]">
                {weather?.locationName || localityLine} ·{' '}
                {weather?.sourceLabel || (weatherLoading ? 'Loading live weather...' : 'Offline')}
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

          {weather ? (
            <>
              <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
                {weather.forecast.slice(0, 7).map((day, idx) => (
                  <div
                    key={day.date}
                    className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-2 text-center flex flex-col items-center gap-0.5"
                  >
                    <p className="text-[11px] font-semibold text-[#202820] truncate w-full">
                      {idx === 0 ? 'Today' : day.weekday}
                    </p>
                    <p className="text-[10px] text-[#6B756A] truncate w-full">{day.shortDate}</p>
                    <div className="my-0.5">
                      {renderCompactWeatherIcon(day.condition, day.rainProbability)}
                    </div>
                    <p className="font-mono text-xs font-bold text-[#202820] tabular-nums">
                      {day.maxTemp !== null ? `${day.maxTemp}°` : '—'}
                    </p>
                    <p className="font-mono text-[11px] text-[#6B756A] tabular-nums">
                      {day.minTemp !== null ? `${day.minTemp}°` : '—'}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] font-semibold text-[#5A91C8] tabular-nums">
                      {day.rainProbability !== null ? `${day.rainProbability}%` : '—'}
                    </p>
                  </div>
                ))}
              </div>

              {weather.advisories[0] && (
                <div className="rounded-xl border border-[#E4E9E0] bg-[#EAF3E8]/40 px-3.5 py-2.5 text-xs text-[#202820]">
                  <span className="font-semibold text-[#245C3A]">
                    {weather.advisories[0].sourceType === 'crop_suggestion'
                      ? 'Crop Advisory: '
                      : 'Weather Advisory: '}
                  </span>
                  {weather.advisories[0].recommendation}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-5 text-center space-y-2">
              <p className="text-xs text-[#6B756A]">
                {weatherLoading
                  ? 'Fetching live 7-day weather forecast via Gemini Search...'
                  : weatherError || 'Unable to load live weather right now.'}
              </p>
              {!weatherLoading && (
                <button
                  type="button"
                  onClick={onRetryWeather}
                  className="px-3 py-1.5 rounded-lg bg-[#245C3A] text-white text-xs font-semibold cursor-pointer"
                >
                  Retry Weather
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
