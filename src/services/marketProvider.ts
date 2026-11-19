import {CROP_PRODUCTS} from '../data/crops';
import {haversineKm, KARNATAKA_MARKETS} from '../data/locations';
import {
  CropCategory,
  CropProduct,
  LocationOption,
  MarketFeedResponse,
  MarketPriceEntry,
  MarketPriceObservation,
  MarketSyncStatus,
  PriceHistoryPoint,
} from '../types/krishi';

export interface MarketComparisonSummary {
  entries: MarketPriceEntry[];
  highest: MarketPriceEntry;
  lowest: MarketPriceEntry;
  averageModal: number;
  spread: number;
  spreadPercent: number;
}

export interface CalculatedInsightItem {
  id: string;
  category: 'market_spread' | 'weekly_trend' | 'seasonal_watch';
  title: string;
  metric: string;
  detail: string;
  cropId: string;
  isReference: boolean;
}

export const UNAVAILABLE_PRICE_MESSAGE =
  'Latest verified market price is currently unavailable.';

export const DEFAULT_MARKET_SYNC_STATUS: MarketSyncStatus = {
  sourceStatus: 'unavailable',
  sourceLabel: 'Checking Gemini live market search...',
  lastSyncAt: null,
  observationDate: null,
  recordCount: 0,
  matchedCropCount: 0,
  isStale: true,
  staleReason: null,
  geminiSearchEnabled: true,
  quotaLimited: false,
  missingCredentials: [],
  nextScheduledSyncAt: null,
};

export function mergeMarketObservations(
  baseProducts: CropProduct[],
  observations: Record<string, MarketPriceObservation>,
  status: MarketSyncStatus,
): CropProduct[] {
  return baseProducts.map((crop) => {
    const obs = observations[crop.id];
    if (!obs) {
      return {
        ...crop,
        hasVerifiedPrice: false,
        hasComparableHistory: false,
        priceChangePercent: 0,
        priceChangeAbsolute: null,
        previousComparablePrice: null,
        dataSource: 'unavailable',
        isDemo: true,
        isStale: true,
        sourceName: undefined,
        sourceUrl: undefined,
        sourceUrls: undefined,
        retrievedAt: undefined,
        observationDate: undefined,
      };
    }

    const hasComparableHistory = obs.priceChangePercent !== null;

    return {
      ...crop,
      variety: obs.variety || crop.variety,
      modalPrice: obs.modalPriceKg,
      minimumPrice: obs.minPriceKg,
      maximumPrice: obs.maxPriceKg,
      modalPriceQuintal: obs.modalPriceQuintal,
      minimumPriceQuintal: obs.minPriceQuintal,
      maximumPriceQuintal: obs.maxPriceQuintal,
      measurementUnit: obs.measurementUnit,
      priceChangePercent: obs.priceChangePercent ?? 0,
      priceChangeAbsolute: obs.priceChangeAbsoluteKg,
      previousComparablePrice: obs.previousComparableModalKg,
      hasComparableHistory,
      hasVerifiedPrice: true,
      market: obs.market,
      marketState: obs.state,
      marketDistrict: obs.district,
      updatedAt: obs.arrivalDate,
      observationDate: obs.arrivalDate,
      retrievedAt: obs.retrievedAt,
      sourceName: obs.sourceName,
      sourceUrl: obs.sourceUrl,
      sourceUrls: obs.sourceUrls,
      isDemo: false,
      dataSource: obs.sourceStatus || status.sourceStatus,
      isStale: status.isStale,
      priceHistory: {
        ...crop.priceHistory,
        '7d': obs.history7d.length > 0 ? obs.history7d : [],
      },
      marketComparisons: obs.comparisons.length > 0 ? obs.comparisons : [],
    };
  });
}

export async function fetchDynamicMarketFeed(params: {
  state?: string;
  district?: string;
  preferredMandi?: string;
  cropIds?: string[];
  autoFetch?: boolean;
}): Promise<MarketFeedResponse> {
  const qs = new URLSearchParams();
  if (params.state) qs.set('state', params.state);
  if (params.district) qs.set('district', params.district);
  if (params.preferredMandi) qs.set('preferredMandi', params.preferredMandi);
  if (params.cropIds && params.cropIds.length > 0) {
    qs.set('crops', params.cropIds.slice(0, 6).join(','));
  }
  if (params.autoFetch) {
    qs.set('autoFetch', '1');
  }

  const res = await fetch(`/api/market/prices?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Market feed HTTP ${res.status}`);
  }
  return (await res.json()) as MarketFeedResponse;
}

export async function triggerGeminiMarketSync(params: {
  state?: string;
  district?: string;
  preferredMandi?: string;
  cropIds?: string[];
  forceRefresh?: boolean;
}): Promise<MarketFeedResponse> {
  const res = await fetch('/api/market/sync', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as MarketFeedResponse & {error?: string};
  if (!res.ok) {
    throw new Error(data.error || 'Unable to retrieve live market prices via Gemini Search.');
  }
  return data;
}

export async function fetchSingleCropLivePrice(params: {
  cropId: string;
  state?: string;
  district?: string;
  preferredMandi?: string;
  forceRefresh?: boolean;
}): Promise<MarketFeedResponse> {
  const res = await fetch('/api/market/crop-search', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as MarketFeedResponse & {error?: string};
  if (!res.ok) {
    throw new Error(data.error || 'Unable to retrieve verified price for this crop.');
  }
  return data;
}

export function getMarketComparisonForProduct(
  product: CropProduct | undefined,
  location: LocationOption,
): MarketComparisonSummary | null {
  if (!product || !product.hasVerifiedPrice || product.marketComparisons.length === 0) {
    return null;
  }

  const entries = product.marketComparisons.map((entry) => {
    const center = KARNATAKA_MARKETS.find((m) => m.id === entry.marketId);
    const distanceKm = center
      ? Math.max(5, haversineKm(location.lat, location.lng, center.lat, center.lng))
      : entry.distanceKm;
    return {
      ...entry,
      distanceKm,
    };
  });

  const sorted = [...entries].sort((a, b) => b.modalPrice - a.modalPrice);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  const averageModal = Number(
    (entries.reduce((sum, item) => sum + item.modalPrice, 0) / entries.length).toFixed(1),
  );
  const spread = Number((highest.modalPrice - lowest.modalPrice).toFixed(1));
  const spreadPercent =
    lowest.modalPrice > 0 ? Math.round((spread / lowest.modalPrice) * 100) : 0;

  return {
    entries: sorted,
    highest,
    lowest,
    averageModal,
    spread,
    spreadPercent,
  };
}

export function calculateInsightsForProducts(products: CropProduct[]): CalculatedInsightItem[] {
  const verified = products.filter((p) => p.hasVerifiedPrice);
  if (verified.length === 0) {
    return [];
  }

  const items: CalculatedInsightItem[] = [];
  const withHistory = verified.filter((p) => p.hasComparableHistory);

  if (withHistory.length > 0) {
    const sortedByGain = [...withHistory].sort(
      (a, b) => b.priceChangePercent - a.priceChangePercent,
    );
    const topGainer = sortedByGain[0];
    items.push({
      id: 'ins-gain-1',
      category: 'weekly_trend',
      title: `${topGainer.name} leads verified price movement`,
      metric: `${topGainer.priceChangePercent > 0 ? '+' : ''}${topGainer.priceChangePercent}% · ₹${topGainer.modalPrice}/kg`,
      detail: `${topGainer.name} (${topGainer.variety}) recorded ₹${topGainer.modalPrice}/kg at ${topGainer.market} (${topGainer.observationDate || topGainer.updatedAt}), grounded via ${topGainer.sourceName || 'Gemini Search'}.`,
      cropId: topGainer.id,
      isReference: false,
    });
  } else {
    const topModal = [...verified].sort((a, b) => b.modalPrice - a.modalPrice)[0];
    items.push({
      id: 'ins-verified-1',
      category: 'weekly_trend',
      title: `Latest verified rate: ${topModal.name}`,
      metric: `₹${topModal.modalPrice}/kg (₹${topModal.modalPriceQuintal ?? Math.round(topModal.modalPrice * 100)}/qtl)`,
      detail: `Verified at ${topModal.market}${topModal.marketState ? `, ${topModal.marketState}` : ''} on ${topModal.observationDate || topModal.updatedAt}. Additional daily syncs will unlock multi-day % change history.`,
      cropId: topModal.id,
      isReference: false,
    });
  }

  const spreads = verified
    .filter((p) => p.marketComparisons.length >= 2)
    .map((crop) => {
      const prices = crop.marketComparisons.map((m) => m.modalPrice);
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      return {crop, spread: Number((max - min).toFixed(1)), max, min};
    })
    .sort((a, b) => b.spread - a.spread);

  if (spreads[0]) {
    const best = spreads[0];
    items.push({
      id: 'ins-spread-1',
      category: 'market_spread',
      title: `Observed mandi spread in ${best.crop.name}`,
      metric: `₹${best.spread}/kg spread`,
      detail: `Verified modal prices for ${best.crop.name} span ₹${best.min}/kg to ₹${best.max}/kg across reported markets. Weigh crate transport and hamali charges before travelling farther.`,
      cropId: best.crop.id,
      isReference: false,
    });
  }

  for (const crop of verified.slice(0, 3)) {
    if (items.some((i) => i.cropId === crop.id)) continue;
    items.push({
      id: `ins-obs-${crop.id}`,
      category: 'seasonal_watch',
      title: `${crop.name} · ${crop.market}`,
      metric: `₹${crop.minimumPrice}–₹${crop.maximumPrice}/kg`,
      detail: `Modal ₹${crop.modalPrice}/kg reported on ${crop.observationDate || crop.updatedAt} (${crop.sourceName || 'Verified Online Source'}). Shelf life: ${crop.shelfLife}.`,
      cropId: crop.id,
      isReference: false,
    });
  }

  return items;
}

export interface MarketDataProvider {
  getAllProducts(): CropProduct[];
  getProductsByCategory(category: CropCategory): CropProduct[];
  getProductById(id: string): CropProduct | undefined;
  getPriceHistory(cropId: string, range: '7d' | '30d' | '90d'): PriceHistoryPoint[];
  getMarketComparison(cropId: string, location: LocationOption): MarketComparisonSummary | null;
  generateCalculatedInsights(): CalculatedInsightItem[];
}

export class CatalogMarketDataProvider implements MarketDataProvider {
  getAllProducts(): CropProduct[] {
    return CROP_PRODUCTS;
  }

  getProductsByCategory(category: CropCategory): CropProduct[] {
    return CROP_PRODUCTS.filter((c) => c.category === category);
  }

  getProductById(id: string): CropProduct | undefined {
    return CROP_PRODUCTS.find((c) => c.id === id);
  }

  getPriceHistory(cropId: string, range: '7d' | '30d' | '90d'): PriceHistoryPoint[] {
    const product = this.getProductById(cropId);
    if (!product) return [];
    return product.priceHistory[range];
  }

  getMarketComparison(cropId: string, location: LocationOption): MarketComparisonSummary | null {
    return getMarketComparisonForProduct(this.getProductById(cropId), location);
  }

  generateCalculatedInsights(): CalculatedInsightItem[] {
    return calculateInsightsForProducts(CROP_PRODUCTS);
  }
}

export const marketProvider: MarketDataProvider = new CatalogMarketDataProvider();
