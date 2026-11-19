import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Check,
  Droplets,
  ExternalLink,
  Globe,
  Info,
  Map as MapIcon,
  Minus,
  PackageCheck,
  RefreshCw,
  Share2,
  Sprout,
  ThermometerSnowflake,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {
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
import {fetchMandiGrounding, MandiGroundingResult} from '../services/aiClient';
import {
  getMarketComparisonForProduct,
  UNAVAILABLE_PRICE_MESSAGE,
} from '../services/marketProvider';
import {
  CropProduct,
  LanguageCode,
  LocationOption,
  PriceAlert,
  PriceDisplayUnit,
} from '../types/krishi';
import {CropImage} from './CropImage';
import {MandiMap} from './MandiMap';

interface ProductDetailPanelProps {
  crop: CropProduct;
  allProducts: CropProduct[];
  priceUnit: PriceDisplayUnit;
  t: TranslationPack;
  language: LanguageCode;
  location: LocationOption;
  isFavorite: boolean;
  cropAlerts: PriceAlert[];
  isFetchingLivePrice?: boolean;
  onFetchLivePrice?: () => void;
  onToggleFavorite: (cropId: string) => void;
  onOpenAlertModal: (crop: CropProduct) => void;
  onSelectCrop: (cropId: string) => void;
  onNotify: (msg: string) => void;
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

export function ProductDetailPanel({
  crop,
  allProducts,
  priceUnit,
  t,
  language,
  location,
  isFavorite,
  cropAlerts,
  isFetchingLivePrice = false,
  onFetchLivePrice,
  onToggleFavorite,
  onOpenAlertModal,
  onSelectCrop,
  onNotify,
  audioActiveKey,
  audioLoadingKey,
  onListen,
}: ProductDetailPanelProps) {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [showMandiMap, setShowMandiMap] = useState(false);
  const [groundingLoading, setGroundingLoading] = useState<'search' | 'maps' | null>(null);
  const [groundingResult, setGroundingResult] = useState<MandiGroundingResult | null>(null);
  const [groundingError, setGroundingError] = useState<string | null>(null);

  const cropName = t.cropNames[crop.id] || crop.name;
  const marketDisplayName = t.marketNames[crop.marketId] || crop.market;

  const comparison = useMemo(
    () => getMarketComparisonForProduct(crop, location),
    [crop, location],
  );

  const chartData = crop.priceHistory[range];

  const relatedCrops = useMemo(
    () =>
      crop.relatedCropIds
        .map((id) => allProducts.find((p) => p.id === id))
        .filter((item): item is CropProduct => Boolean(item))
        .slice(0, 3),
    [crop.relatedCropIds, allProducts],
  );

  const formatRate = (kgVal: number, qtlVal?: number) => {
    if (priceUnit === 'quintal') {
      return `₹${Math.round(qtlVal ?? kgVal * 100)}/qtl`;
    }
    return `₹${kgVal}/kg`;
  };

  const modalDisplay =
    priceUnit === 'quintal'
      ? Math.round(crop.modalPriceQuintal ?? crop.modalPrice * 100)
      : crop.modalPrice;
  const minDisplay =
    priceUnit === 'quintal'
      ? Math.round(crop.minimumPriceQuintal ?? crop.minimumPrice * 100)
      : crop.minimumPrice;
  const maxDisplay =
    priceUnit === 'quintal'
      ? Math.round(crop.maximumPriceQuintal ?? crop.maximumPrice * 100)
      : crop.maximumPrice;
  const unitSuffix = priceUnit === 'quintal' ? 'qtl' : 'kg';

  const isRising = crop.priceChangePercent > 0.5;
  const isFalling = crop.priceChangePercent < -0.5;
  const audioKey = `crop-${crop.id}`;
  const isPlaying = audioActiveKey === audioKey;
  const isAudioLoading = audioLoadingKey === audioKey;

  const handleRunGrounding = async (mode: 'search' | 'maps') => {
    setGroundingLoading(mode);
    setGroundingError(null);
    try {
      const result = await fetchMandiGrounding({
        cropName: crop.name,
        marketName: crop.market,
        locationName: `${location.district}, ${location.state}`,
        mode,
        lat: location.lat,
        lng: location.lng,
        language,
      });
      setGroundingResult(result);
    } catch (err: unknown) {
      setGroundingError(
        err instanceof Error ? err.message : 'Unable to load live mandi intelligence right now.',
      );
    } finally {
      setGroundingLoading(null);
    }
  };

  const handleCopyShare = async () => {
    const shareText = crop.hasVerifiedPrice
      ? `${cropName} (${crop.variety}) — ${marketDisplayName}: Modal ₹${crop.modalPrice}/kg (₹${crop.modalPriceQuintal ?? Math.round(crop.modalPrice * 100)}/quintal), Range ₹${crop.minimumPrice}–₹${crop.maximumPrice}/kg. Date: ${crop.observationDate || crop.updatedAt}. Source: ${crop.sourceName || 'Gemini Search'}${crop.sourceUrl ? ` (${crop.sourceUrl})` : ''}.`
      : `${cropName} (${crop.variety}) — ${UNAVAILABLE_PRICE_MESSAGE}`;
    try {
      await navigator.clipboard.writeText(shareText);
      onNotify(`Copied ${cropName} summary to clipboard.`);
    } catch {
      onNotify(shareText);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  };

  const nutritionCards = [
    {label: t.energy, value: `${crop.nutrition.energyKcal} kcal`},
    {label: t.water, value: `${crop.nutrition.waterPercent}%`},
    {label: t.carbohydrates, value: `${crop.nutrition.carbsG} g`},
    {label: t.protein, value: `${crop.nutrition.proteinG} g`},
    {label: t.fiber, value: `${crop.nutrition.fiberG} g`},
    {label: t.fat, value: `${crop.nutrition.fatG} g`},
    ...(crop.nutrition.vitaminCMg !== undefined
      ? [{label: t.vitaminC, value: `${crop.nutrition.vitaminCMg} mg`}]
      : []),
    ...(crop.nutrition.potassiumMg !== undefined
      ? [{label: t.potassium, value: `${crop.nutrition.potassiumMg} mg`}]
      : []),
  ];

  return (
    <article className="space-y-6" aria-label={cropName}>
      {/* Sticky Mobile Quick-Jump Strip */}
      <div className="lg:hidden sticky top-14 z-30 -mx-4 px-4 py-2 bg-[#F7F8F4]/95 backdrop-blur-sm border-b border-[#E4E9E0]">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            {id: 'sec-price', label: t.stickyPrice},
            {id: 'sec-markets', label: t.stickyMarkets},
            {id: 'sec-nutrition', label: t.stickyNutrition},
            {id: 'sec-crop-info', label: t.stickyCropInfo},
          ].map((jump) => (
            <button
              key={jump.id}
              type="button"
              onClick={() => scrollToSection(jump.id)}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#E4E9E0] text-xs font-semibold text-[#202820] whitespace-nowrap cursor-pointer"
            >
              {jump.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION A: PRODUCT HEADER */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row gap-5 md:items-center">
          <CropImage
            src={crop.image}
            alt={`${cropName} (${crop.variety}) fresh produce`}
            category={crop.category}
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border border-[#E4E9E0] shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#6B756A]">
              <span className="uppercase tracking-wider font-semibold text-[#245C3A]">
                {crop.category === 'vegetable' ? t.vegetables : t.fruits}
              </span>
              <span>·</span>
              <span>{crop.variety}</span>
              <span>·</span>
              <span>{marketDisplayName}</span>
            </div>

            <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-[#202820] tracking-tight">
              {cropName}
            </h2>

            {crop.regionalNames && crop.regionalNames.length > 0 && (
              <p className="mt-1 text-xs text-[#5B675B]">
                Also known as: {crop.regionalNames.join(' · ')}
              </p>
            )}

            <p className="mt-1.5 text-sm text-[#6B756A] leading-relaxed max-w-2xl">
              {crop.description}
            </p>

            {crop.varieties && crop.varieties.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {crop.varieties.map((v) => (
                  <span
                    key={v}
                    className="px-2.5 py-0.5 rounded-md bg-[#F4F7F1] border border-[#E2E8DC] text-[11px] font-medium text-[#3C483C]"
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-2 text-xs text-[#6B756A] tabular-nums">
              {crop.hasVerifiedPrice
                ? `Verified via ${crop.sourceName || 'Gemini Search Grounding'} · Date: ${crop.observationDate || crop.updatedAt}${
                    crop.retrievedAt
                      ? ` · Retrieved ${new Date(crop.retrievedAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ''
                  }`
                : UNAVAILABLE_PRICE_MESSAGE}
            </p>

            {/* Primary Action Row */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onToggleFavorite(crop.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer min-h-[44px] ${
                  isFavorite
                    ? 'bg-[#EAF3E8] border-[#245C3A] text-[#245C3A]'
                    : 'bg-[#245C3A] border-[#245C3A] text-white hover:bg-[#1d4b2f]'
                }`}
              >
                {isFavorite ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
                <span>{isFavorite ? t.savedInMyCrops : t.addToMyCrops}</span>
              </button>

              {onFetchLivePrice && (
                <button
                  type="button"
                  disabled={isFetchingLivePrice}
                  onClick={onFetchLivePrice}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#245C3A]/35 bg-[#EAF3E8] text-[#1E4A2F] hover:bg-[#DCECD8] disabled:opacity-60 cursor-pointer min-h-[44px]"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetchingLivePrice ? 'animate-spin' : ''}`} />
                  <span>
                    {isFetchingLivePrice
                      ? 'Searching Live Mandis...'
                      : crop.hasVerifiedPrice
                        ? 'Refresh Live Price'
                        : 'Fetch Live Price'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenAlertModal(crop)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E4E9E0] bg-white text-[#202820] hover:bg-[#FAF9F4] cursor-pointer min-h-[44px]"
              >
                <BellRing className="w-4 h-4 text-[#245C3A]" />
                <span>{t.setPriceAlert}</span>
                {cropAlerts.length > 0 && (
                  <span className="font-mono text-xs text-[#245C3A] tabular-nums">
                    ({cropAlerts.length})
                  </span>
                )}
              </button>

              <button
                type="button"
                disabled={isAudioLoading}
                onClick={() =>
                  onListen({
                    key: audioKey,
                    text: crop.hasVerifiedPrice
                      ? `${cropName} at ${marketDisplayName}. Verified modal rate is ${crop.modalPrice} rupees per kilogram (${crop.modalPriceQuintal ?? Math.round(crop.modalPrice * 100)} rupees per quintal), ranging from ${crop.minimumPrice} to ${crop.maximumPrice} rupees per kilogram as of ${crop.observationDate || crop.updatedAt}. ${crop.farmerInsights[0] || ''}`
                      : `${cropName}. ${UNAVAILABLE_PRICE_MESSAGE} ${crop.farmerInsights[0] || ''}`,
                    language,
                    quickSummarizeTopic: `${crop.name} market rate and harvest advice`,
                    quickSummarizePayload: {
                      crop: crop.name,
                      market: crop.hasVerifiedPrice ? crop.market : null,
                      hasVerifiedPrice: Boolean(crop.hasVerifiedPrice),
                      modalPriceInrPerKg: crop.hasVerifiedPrice ? crop.modalPrice : null,
                      modalPriceInrPerQuintal: crop.hasVerifiedPrice
                        ? crop.modalPriceQuintal ?? Math.round(crop.modalPrice * 100)
                        : null,
                      observationDate: crop.observationDate || null,
                      tip: crop.farmerInsights[0],
                    },
                  })
                }
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-[#E4E9E0] bg-[#FAF9F4] text-[#202820] hover:bg-[#EAF3E8] cursor-pointer min-h-[44px]"
              >
                {isPlaying ? (
                  <VolumeX className="w-4 h-4 text-[#245C3A]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#245C3A]" />
                )}
                <span>
                  {isAudioLoading
                    ? t.loadingAudio
                    : isPlaying
                      ? t.stopAudio
                      : t.listenSummary}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopyShare()}
                aria-label="Share crop price summary"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border border-[#E4E9E0] bg-white text-[#6B756A] hover:text-[#202820] hover:bg-[#FAF9F4] cursor-pointer min-h-[44px]"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION B: VERIFIED LIVE MARKET PRICE OVERVIEW */}
      <section
        id="sec-price"
        className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6"
      >
        {crop.hasVerifiedPrice ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#245C3A]">
                  {t.modalPriceToday} · {marketDisplayName}
                  {crop.marketDistrict ? `, ${crop.marketDistrict}` : ''}
                  {crop.marketState ? `, ${crop.marketState}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-4xl sm:text-5xl font-bold text-[#202820] tabular-nums">
                    ₹{modalDisplay}
                  </span>
                  <span className="text-lg font-medium text-[#6B756A]">/ {unitSuffix}</span>

                  {crop.hasComparableHistory ? (
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${
                        isRising
                          ? 'text-[#245C3A]'
                          : isFalling
                            ? 'text-amber-700'
                            : 'text-[#6B756A]'
                      }`}
                    >
                      {isRising ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : isFalling ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <Minus className="w-4 h-4" />
                      )}
                      <span>
                        {crop.priceChangePercent > 0 ? '+' : ''}
                        {crop.priceChangePercent}%
                      </span>
                      <span className="font-normal text-[#6B756A]">
                        · {isRising ? t.priceRising : isFalling ? t.priceFalling : t.priceStable}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-[#6B756A] bg-[#F4F7F1] px-2.5 py-1 rounded-lg border border-[#E2E8DC]">
                      First verified date recorded
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-[#6B756A] font-mono tabular-nums">
                  Equivalent:{' '}
                  {priceUnit === 'quintal'
                    ? `₹${crop.modalPrice}/kg`
                    : `₹${Math.round(crop.modalPriceQuintal ?? crop.modalPrice * 100)}/quintal (100 kg)`}
                  {' · '}
                  Observation: {crop.observationDate || crop.updatedAt}
                </p>
              </div>

              <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3.5">
                  <p className="text-xs text-[#6B756A]">{t.minPrice}</p>
                  <p className="mt-1 font-mono text-xl font-bold text-[#202820] tabular-nums">
                    ₹{minDisplay}/{unitSuffix}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3.5">
                  <p className="text-xs text-[#6B756A]">{t.maxPrice}</p>
                  <p className="mt-1 font-mono text-xl font-bold text-[#202820] tabular-nums">
                    ₹{maxDisplay}/{unitSuffix}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-[#E4E9E0] bg-[#EAF3E8]/60 p-3.5">
                  <p className="text-xs text-[#245C3A] font-medium">Unit Basis</p>
                  <p className="mt-1 text-xs font-semibold text-[#245C3A] leading-snug">
                    {crop.measurementUnit || '₹/Quintal & ₹/kg'}
                  </p>
                </div>
              </div>
            </div>

            {/* Verified Online Source Citations & Retrieval Timestamp */}
            <div className="pt-3 border-t border-[#E4E9E0] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#202820]">
                  Source: {crop.sourceName || 'Online Mandi Report'}
                </span>
                {crop.sourceUrls && crop.sourceUrls.length > 0 ? (
                  crop.sourceUrls.slice(0, 3).map((src, i) => (
                    <a
                      key={`${src.url}-${i}`}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F7F1] border border-[#E2E8DC] text-[#245C3A] font-medium hover:underline"
                    >
                      <span className="max-w-[180px] truncate">{src.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))
                ) : crop.sourceUrl ? (
                  <a
                    href={crop.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F7F1] border border-[#E2E8DC] text-[#245C3A] font-medium hover:underline"
                  >
                    <span>Verify Source</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : null}
              </div>
              {crop.retrievedAt && (
                <span className="font-mono text-[11px] text-[#6B756A]">
                  Retrieved:{' '}
                  {new Date(crop.retrievedAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#D3DDD0] bg-[#FAF9F4] p-6 text-center space-y-3">
            <Globe className="w-7 h-7 text-[#245C3A] mx-auto" />
            <div>
              <h3 className="text-base font-bold text-[#202820]">
                {UNAVAILABLE_PRICE_MESSAGE}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#6B756A] max-w-lg mx-auto">
                We only display verified online mandi prices retrieved via Gemini Google Search
                grounding. Tap below to search current APMC, eNAM, and state marketing portals for{' '}
                {cropName} in {location.district}, {location.state}.
              </p>
            </div>
            {onFetchLivePrice && (
              <button
                type="button"
                disabled={isFetchingLivePrice}
                onClick={onFetchLivePrice}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isFetchingLivePrice ? 'animate-spin' : ''}`} />
                <span>
                  {isFetchingLivePrice
                    ? `Searching online mandis for ${cropName}...`
                    : `Fetch Live ${cropName} Price via Gemini`}
                </span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* SECTION C: VERIFIED PRICE TREND & HISTORICAL CHART */}
      {crop.hasVerifiedPrice && (
        <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-[#202820]">{t.priceTrend}</h3>
              <p className="text-xs text-[#6B756A]">
                Verified historical mandi observations archived from Gemini Google Search grounding
                (₹/kg)
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-1">
              {(
                [
                  {key: '7d', label: t.days7},
                  {key: '30d', label: t.days30},
                  {key: '90d', label: t.days90},
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRange(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    range === opt.key
                      ? 'bg-white text-[#245C3A] shadow-xs border border-[#E4E9E0]'
                      : 'text-[#6B756A] hover:text-[#202820]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {chartData.length >= 2 ? (
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{top: 8, right: 12, left: -12, bottom: 4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{fontSize: 11, fill: '#6B756A'}}
                    tickLine={false}
                    axisLine={{stroke: '#E4E9E0'}}
                    minTickGap={22}
                  />
                  <YAxis
                    tick={{fontSize: 11, fill: '#6B756A'}}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E4E9E0',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(value: unknown, name: unknown) => [`₹${value}/kg`, String(name)]}
                  />
                  <Legend wrapperStyle={{fontSize: '12px'}} />
                  <Line
                    type="monotone"
                    dataKey="max"
                    name={t.maxPrice}
                    stroke="#78A85A"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="modal"
                    name="Modal"
                    stroke="#245C3A"
                    strokeWidth={2.75}
                    dot={range === '7d' ? {r: 3, fill: '#245C3A'} : false}
                    activeDot={{r: 5}}
                  />
                  <Line
                    type="monotone"
                    dataKey="min"
                    name={t.minPrice}
                    stroke="#94A393"
                    strokeWidth={1.75}
                    strokeDasharray="2 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-4 text-xs text-[#6B756A]">
              Historical trend chart builds automatically once observations from 2 or more distinct
              market dates are retrieved for {cropName}. Current verified observation:{' '}
              <strong className="text-[#202820]">
                ₹{crop.modalPrice}/kg on {crop.observationDate || crop.updatedAt}
              </strong>
              .
            </div>
          )}
        </section>
      )}

      {/* SECTION D: MARKET COMPARISON + INTERACTIVE MAP + GEMINI LIVE MANDI GROUNDING */}
      {comparison && (
        <section
          id="sec-markets"
          className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#202820]">{t.marketComparison}</h3>
              <p className="text-xs text-[#6B756A]">
                Wholesale APMC mandi comparison for {cropName} · Distances from{' '}
                {location.district}, {location.state}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMandiMap((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  showMandiMap
                    ? 'bg-[#EAF3E8] border-[#245C3A] text-[#245C3A]'
                    : 'bg-white border-[#E4E9E0] text-[#202820] hover:bg-[#FAF9F4]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{showMandiMap ? 'Hide Map View' : t.findMandisOnMap}</span>
              </button>
              <button
                type="button"
                disabled={groundingLoading !== null}
                onClick={() => void handleRunGrounding('search')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#E4E9E0] bg-[#FAF9F4] text-[#202820] hover:bg-[#EAF3E8] cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[#245C3A]" />
                <span>
                  {groundingLoading === 'search' ? 'Checking web...' : t.fetchLiveMandi}
                </span>
              </button>
              <button
                type="button"
                disabled={groundingLoading !== null}
                onClick={() => void handleRunGrounding('maps')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#E4E9E0] bg-[#FAF9F4] text-[#202820] hover:bg-[#EAF3E8] cursor-pointer"
              >
                <MapIcon className="w-3.5 h-3.5 text-[#245C3A]" />
                <span>
                  {groundingLoading === 'maps' ? 'Finding mandis...' : 'Nearby APMC Info'}
                </span>
              </button>
            </div>
          </div>

          {/* 3 Summary Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#E4E9E0] bg-[#EAF3E8]/55 p-3.5">
              <p className="text-xs text-[#245C3A] font-medium">{t.highestListedPrice}</p>
              <p className="mt-1 font-mono text-xl font-bold text-[#202820] tabular-nums">
                {formatRate(comparison.highest.modalPrice, comparison.highest.modalPriceQuintal)}
              </p>
              <p className="text-xs text-[#6B756A] mt-0.5">
                {t.marketNames[comparison.highest.marketId] || comparison.highest.marketName}
              </p>
            </div>

            <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3.5">
              <p className="text-xs text-[#6B756A]">{t.lowestListedPrice}</p>
              <p className="mt-1 font-mono text-xl font-bold text-[#202820] tabular-nums">
                {formatRate(comparison.lowest.modalPrice, comparison.lowest.modalPriceQuintal)}
              </p>
              <p className="text-xs text-[#6B756A] mt-0.5">
                {t.marketNames[comparison.lowest.marketId] || comparison.lowest.marketName}
              </p>
            </div>

            <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3.5">
              <p className="text-xs text-[#6B756A]">{t.priceDifference}</p>
              <p className="mt-1 font-mono text-xl font-bold text-[#245C3A] tabular-nums">
                ₹{priceUnit === 'quintal' ? Math.round(comparison.spread * 100) : comparison.spread}/
                {unitSuffix} ({comparison.spreadPercent}%)
              </p>
              <p className="text-xs text-[#6B756A] mt-0.5">
                Avg {formatRate(comparison.averageModal)} across {comparison.entries.length} mandis
              </p>
            </div>
          </div>

          {showMandiMap && (
            <MandiMap
              cropName={cropName}
              entries={comparison.entries}
              highestMarketId={comparison.highest.marketId}
              location={location}
            />
          )}

          {/* Grounding Results Card */}
          {(groundingError || groundingResult) && (
            <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#245C3A]">
                  {groundingResult?.mode === 'maps'
                    ? 'Nearby Mandi Places (Gemini + Google Maps Grounding)'
                    : 'Live Market Web Context (Gemini + Google Search Grounding)'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setGroundingResult(null);
                    setGroundingError(null);
                  }}
                  className="text-xs text-[#6B756A] hover:text-[#202820] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              {groundingError ? (
                <p className="text-sm text-amber-800">{groundingError}</p>
              ) : (
                groundingResult && (
                  <>
                    <div className="text-sm text-[#202820] whitespace-pre-line leading-relaxed">
                      {groundingResult.text}
                    </div>
                    {groundingResult.sources.length > 0 && (
                      <div className="pt-2 border-t border-[#E4E9E0] flex flex-wrap gap-2">
                        {groundingResult.sources.map((src, i) => (
                          <a
                            key={`${src.uri}-${i}`}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E4E9E0] text-xs font-medium text-[#245C3A] hover:underline"
                          >
                            <span>{src.title}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          )}

          {/* Desktop Comparison Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4E9E0] text-xs font-semibold text-[#6B756A] uppercase tracking-wider">
                  <th className="py-2.5 pr-4">Market</th>
                  <th className="py-2.5 px-3">Modal Price</th>
                  <th className="py-2.5 px-3">Min – Max</th>
                  <th className="py-2.5 px-3">Approx. Distance</th>
                  <th className="py-2.5 px-3">Change</th>
                  <th className="py-2.5 pl-3 text-right">Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E9E0] text-sm">
                {comparison.entries.map((m) => {
                  const isTop = m.marketId === comparison.highest.marketId;
                  return (
                    <tr key={m.marketId} className={isTop ? 'bg-[#EAF3E8]/35' : ''}>
                      <td className="py-3 pr-4">
                        <span className="font-semibold text-[#202820]">
                          {t.marketNames[m.marketId] || m.marketName}
                        </span>
                        <span className="block text-xs text-[#6B756A]">
                          {m.district}
                          {m.state ? `, ${m.state}` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-[#202820] tabular-nums">
                        {formatRate(m.modalPrice, m.modalPriceQuintal)}
                        {isTop && (
                          <span className="ml-2 text-[11px] font-sans font-semibold text-[#245C3A]">
                            Highest
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-[#6B756A] tabular-nums">
                        {formatRate(m.minPrice, m.minPriceQuintal)} –{' '}
                        {formatRate(m.maxPrice, m.maxPriceQuintal)}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-[#202820] tabular-nums">
                        {m.distanceKm ? `~${m.distanceKm} km` : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs font-semibold tabular-nums">
                        {m.trendPercent === null || crop.isDemo ? (
                          <span className="text-[#6B756A]">—</span>
                        ) : (
                          <span
                            className={m.trendPercent >= 0 ? 'text-[#245C3A]' : 'text-amber-700'}
                          >
                            {m.trendPercent >= 0 ? '+' : ''}
                            {m.trendPercent}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right text-xs text-[#6B756A] tabular-nums">
                        {m.arrivalDate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Comparison Cards */}
          <div className="md:hidden space-y-2.5">
            {comparison.entries.map((m) => {
              const isTop = m.marketId === comparison.highest.marketId;
              return (
                <div
                  key={m.marketId}
                  className={`rounded-xl border p-3.5 ${
                    isTop
                      ? 'border-[#245C3A]/40 bg-[#EAF3E8]/40'
                      : 'border-[#E4E9E0] bg-[#FAF9F4]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#202820]">
                        {t.marketNames[m.marketId] || m.marketName}
                      </p>
                      <p className="text-xs text-[#6B756A] tabular-nums">
                        {m.distanceKm ? `~${m.distanceKm} km · ` : ''}
                        {m.arrivalDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-base text-[#202820] tabular-nums">
                        {formatRate(m.modalPrice, m.modalPriceQuintal)}
                      </p>
                      <p className="font-mono text-[11px] text-[#6B756A] tabular-nums">
                        {formatRate(m.minPrice, m.minPriceQuintal)}–
                        {formatRate(m.maxPrice, m.maxPriceQuintal)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-[#6B756A] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 text-[#245C3A]" />
            <span>{t.transportCostNote}</span>
          </p>
        </section>
      )}

      {/* SECTION E: NUTRITION INFORMATION */}
      <section
        id="sec-nutrition"
        className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#202820]">{t.nutritionTitle}</h3>
            <p className="text-xs text-[#6B756A]">{t.nutritionSubtitle}</p>
          </div>
          <span className="text-xs font-mono text-[#6B756A]">Per 100g edible</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {nutritionCards.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] px-3.5 py-2.5"
            >
              <p className="text-xs text-[#6B756A]">{item.label}</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-[#202820] tabular-nums">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-[#6B756A]">{t.nutritionDisclaimer}</p>
      </section>

      {/* SECTION F & G: CROP INFORMATION & MARKET PREPARATION */}
      <section id="sec-crop-info" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-[#245C3A]" />
            <h3 className="text-lg font-bold text-[#202820]">{t.cropInfoTitle}</h3>
          </div>
          <dl className="space-y-3 text-sm">
            {[
              {label: t.growingSeason, value: crop.cropInfo.growingSeason},
              {label: t.climate, value: crop.cropInfo.climate},
              {label: t.waterReq, value: crop.cropInfo.waterRequirements},
              {label: t.soil, value: crop.cropInfo.soil},
            ].map((row) => (
              <div
                key={row.label}
                className="border-b border-[#E4E9E0] last:border-b-0 pb-2.5 last:pb-0"
              >
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
                  {row.label}
                </dt>
                <dd className="mt-0.5 text-[#202820] leading-relaxed">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[#245C3A]" />
            <h3 className="text-lg font-bold text-[#202820]">{t.prepareProduceTitle}</h3>
          </div>
          <dl className="space-y-3 text-sm">
            {[
              {label: t.harvest, value: crop.cropInfo.harvesting},
              {label: t.postHarvest, value: crop.cropInfo.postHarvest},
              {label: t.transport, value: crop.cropInfo.transport},
            ].map((row) => (
              <div key={row.label} className="border-b border-[#E4E9E0] pb-2.5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
                  {row.label}
                </dt>
                <dd className="mt-0.5 text-[#202820] leading-relaxed">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-2">
              Buyer Quality Checklist
            </p>
            <ul className="space-y-1.5">
              {crop.marketQuality.map((q) => (
                <li key={q} className="flex items-start gap-2 text-sm text-[#202820]">
                  <Check className="w-4 h-4 text-[#245C3A] shrink-0 mt-0.5" />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* SECTION H & I: STORAGE + SEASONAL STRIP */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <ThermometerSnowflake className="w-5 h-5 text-[#245C3A]" />
            <h3 className="text-lg font-bold text-[#202820]">{t.storageShelfLifeTitle}</h3>
          </div>
          <div className="space-y-2.5 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
                {t.storageRec}
              </p>
              <p className="mt-0.5 text-[#202820]">{crop.storage}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
                {t.shelfLifeLabel}
              </p>
              <p className="mt-0.5 font-mono font-semibold text-[#245C3A]">{crop.shelfLife}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
                {t.avoidLabel}
              </p>
              <p className="mt-0.5 text-[#202820]">{crop.conditionsToAvoid}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-[#5A91C8]" />
            <h3 className="text-lg font-bold text-[#202820]">{t.seasonalInfoTitle}</h3>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              {label: t.monsoon, active: crop.seasonality.monsoon},
              {label: t.winter, active: crop.seasonality.winter},
              {label: t.summer, active: crop.seasonality.summer},
            ].map((season) => (
              <div
                key={season.label}
                className={`rounded-xl border px-3 py-2.5 text-center ${
                  season.active
                    ? 'bg-[#EAF3E8] border-[#245C3A]/40 text-[#245C3A]'
                    : 'bg-[#FAF9F4] border-[#E4E9E0] text-[#6B756A]'
                }`}
              >
                <p className="text-xs font-semibold">{season.label}</p>
                <p className="text-[11px] mt-0.5">
                  {season.active ? 'Active season' : 'Off-peak'}
                </p>
              </div>
            ))}
          </div>

          <div className="text-sm space-y-1.5">
            <p className="text-[#202820]">
              <span className="font-semibold">Region:</span> {crop.seasonality.regionLabel}
            </p>
            <p className="text-[#202820]">
              <span className="font-semibold">Harvest window:</span> {crop.seasonality.harvestPeriod}
            </p>
            <p className="text-[#6B756A] text-xs">{crop.seasonality.marketNote}</p>
          </div>
        </div>
      </section>

      {/* SECTION J: FARMER INSIGHTS */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
        <h3 className="text-lg font-bold text-[#202820] mb-3">{t.farmerInsightsTitle}</h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {crop.farmerInsights.map((tip) => (
            <li
              key={tip}
              className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3.5 text-sm text-[#202820] leading-relaxed"
            >
              {tip}
            </li>
          ))}
        </ul>
      </section>

      {/* SECTION K: RELATED CROPS */}
      {relatedCrops.length > 0 && (
        <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
          <h3 className="text-lg font-bold text-[#202820] mb-3">{t.relatedCropsTitle}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {relatedCrops.map((rel) => {
              const relName = t.cropNames[rel.id] || rel.name;
              return (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => onSelectCrop(rel.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] hover:border-[#245C3A] hover:bg-white transition-colors text-left cursor-pointer"
                >
                  <CropImage
                    src={rel.image}
                    alt={relName}
                    category={rel.category}
                    className="w-12 h-12 rounded-xl border border-[#E4E9E0] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#202820] truncate">{relName}</p>
                    <p className="font-mono text-xs font-bold text-[#245C3A] tabular-nums">
                      {rel.hasVerifiedPrice
                        ? formatRate(rel.modalPrice, rel.modalPriceQuintal)
                        : 'Tap to check live rate'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
