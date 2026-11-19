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

export const DEFAULT_MARKET_SYNC_STATUS: MarketSyncStatus = {
  sourceStatus: 'catalog_reference',
  sourceLabel: 'Checking market data feed...',
  lastSyncAt: null,
  observationDate: null,
  recordCount: 0,
  matchedCropCount: 0,
  isStale: true,
  staleReason: null,
  agmarknetConfigured: false,
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
        dataSource: 'catalog_reference',
        isDemo: true,
        isStale: true,
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
      priceChangePercent: obs.priceChangePercent ?? 0,
      priceChangeAbsolute: obs.priceChangeAbsoluteKg,
      previousComparablePrice: obs.previousComparableModalKg,
      hasComparableHistory,
      market: obs.market,
      marketState: obs.state,
      marketDistrict: obs.district,
      updatedAt: obs.arrivalDate,
      observationDate: obs.arrivalDate,
      isDemo: false,
      dataSource: status.sourceStatus,
      isStale: status.isStale,
      priceHistory: {
        ...crop.priceHistory,
        '7d': obs.history7d.length > 0 ? obs.history7d : crop.priceHistory['7d'],
      },
      marketComparisons:
        obs.comparisons.length > 0 ? obs.comparisons : crop.marketComparisons,
    };
  });
}

export async function fetchDynamicMarketFeed(params: {
  state?: string;
  district?: string;
  preferredMandi?: string;
}): Promise<MarketFeedResponse> {
  const qs = new URLSearchParams();
  if (params.state) qs.set('state', params.state);
  if (params.district) qs.set('district', params.district);
  if (params.preferredMandi) qs.set('preferredMandi', params.preferredMandi);

  const res = await fetch(`/api/market/prices?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Market feed HTTP ${res.status}`);
  }
  return (await res.json()) as MarketFeedResponse;
}

export async function triggerMarketSync(state?: string): Promise<MarketFeedResponse> {
  const res = await fetch('/api/market/sync', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({state}),
  });
  const data = (await res.json()) as MarketFeedResponse & {error?: string};
  if (!res.ok) {
    throw new Error(data.error || 'Unable to refresh AGMARKNET prices.');
  }
  return data;
}

export function getMarketComparisonForProduct(
  product: CropProduct | undefined,
  location: LocationOption,
): MarketComparisonSummary | null {
  if (!product || product.marketComparisons.length === 0) return null;

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
  if (products.length === 0) return [];

  const liveWithHistory = products.filter((p) => !p.isDemo && p.hasComparableHistory);
  const pool = liveWithHistory.length >= 2 ? liveWithHistory : products;
  const isRefPool = liveWithHistory.length < 2;

  const sortedByGain = [...pool].sort((a, b) => b.priceChangePercent - a.priceChangePercent);
  const topGainer = sortedByGain[0];
  const secondGainer = sortedByGain[1] || sortedByGain[0];
  const topDrop = [...pool].sort((a, b) => a.priceChangePercent - b.priceChangePercent)[0];

  const spreads = products
    .filter((p) => p.marketComparisons.length >= 2)
    .map((crop) => {
      const prices = crop.marketComparisons.map((m) => m.modalPrice);
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      return {crop, spread: Number((max - min).toFixed(1)), max, min};
    })
    .sort((a, b) => b.spread - a.spread);

  const biggestSpread = spreads[0];
  const vegSpread = spreads.find((s) => s.crop.category === 'vegetable') || biggestSpread;

  const items: CalculatedInsightItem[] = [
    {
      id: 'ins-gain-1',
      category: 'weekly_trend',
      title: isRefPool
        ? `${topGainer.name} reference price benchmark`
        : `${topGainer.name} leads comparable price gains`,
      metric:
        topGainer.hasComparableHistory && !topGainer.isDemo
          ? `${topGainer.priceChangePercent > 0 ? '+' : ''}${topGainer.priceChangePercent}% · ₹${topGainer.modalPrice}/kg`
          : `₹${topGainer.modalPrice}/kg (₹${topGainer.modalPriceQuintal ?? topGainer.modalPrice * 100}/qtl)`,
      detail: isRefPool
        ? `${topGainer.name} (${topGainer.variety}) reference baseline is ₹${topGainer.modalPrice}/kg. Configure live AGMARKNET sync for verified daily mandi movements.`
        : `${topGainer.name} (${topGainer.variety}) recorded the strongest verified comparable gain at ${topGainer.market}, followed by ${secondGainer.name}.`,
      cropId: topGainer.id,
      isReference: topGainer.isDemo,
    },
  ];

  if (biggestSpread) {
    items.push({
      id: 'ins-spread-1',
      category: 'market_spread',
      title: `Widest mandi spread in ${biggestSpread.crop.name}`,
      metric: `₹${biggestSpread.spread}/kg spread`,
      detail: `Modal rates for ${biggestSpread.crop.name} span ₹${biggestSpread.min}/kg to ₹${biggestSpread.max}/kg across listed markets. Always subtract crate transport and hamali cost before travelling further.`,
      cropId: biggestSpread.crop.id,
      isReference: biggestSpread.crop.isDemo,
    });
  }

  if (vegSpread) {
    items.push({
      id: 'ins-spread-veg',
      category: 'market_spread',
      title: `Top vegetable range: ${vegSpread.crop.name}`,
      metric: `₹${vegSpread.min}–₹${vegSpread.max}/kg`,
      detail: `Grade-A sorting, clean moisture-free crates, and early morning arrival help capture the upper end of the ${vegSpread.crop.name} range.`,
      cropId: vegSpread.crop.id,
      isReference: vegSpread.crop.isDemo,
    });
  }

  if (topDrop && topDrop.id !== topGainer.id) {
    items.push({
      id: 'ins-drop-1',
      category: 'seasonal_watch',
      title: topDrop.isDemo
        ? `Market watch: ${topDrop.name}`
        : `Supply softening observed in ${topDrop.name}`,
      metric:
        topDrop.hasComparableHistory && !topDrop.isDemo
          ? `${topDrop.priceChangePercent}% · ₹${topDrop.modalPrice}/kg`
          : `₹${topDrop.modalPrice}/kg`,
      detail: topDrop.isDemo
        ? `${topDrop.name} has a ${topDrop.shelfLife.toLowerCase()} storage profile. Monitor live APMC arrivals once AGMARKNET sync is active.`
        : `Higher mandi arrivals softened ${topDrop.name} modal rates compared to the prior verified date. Consider cured holding where shelf life permits.`,
      cropId: topDrop.id,
      isReference: topDrop.isDemo,
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
