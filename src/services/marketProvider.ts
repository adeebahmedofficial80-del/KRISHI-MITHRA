import {CROP_PRODUCTS} from '../data/crops';
import {haversineKm, KARNATAKA_MARKETS} from '../data/locations';
import {
  CropCategory,
  CropProduct,
  LocationOption,
  MarketPriceEntry,
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
}

export interface MarketDataProvider {
  getAllProducts(): CropProduct[];
  getProductsByCategory(category: CropCategory): CropProduct[];
  getProductById(id: string): CropProduct | undefined;
  getPriceHistory(cropId: string, range: '7d' | '30d' | '90d'): PriceHistoryPoint[];
  getMarketComparison(cropId: string, location: LocationOption): MarketComparisonSummary | null;
  generateCalculatedInsights(): CalculatedInsightItem[];
}

export class DemoMarketDataProvider implements MarketDataProvider {
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
    const product = this.getProductById(cropId);
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
    const averageModal = Math.round(
      entries.reduce((sum, item) => sum + item.modalPrice, 0) / entries.length,
    );
    const spread = highest.modalPrice - lowest.modalPrice;
    const spreadPercent = lowest.modalPrice > 0 ? Math.round((spread / lowest.modalPrice) * 100) : 0;

    return {
      entries: sorted,
      highest,
      lowest,
      averageModal,
      spread,
      spreadPercent,
    };
  }

  generateCalculatedInsights(): CalculatedInsightItem[] {
    const sortedByGain = [...CROP_PRODUCTS].sort(
      (a, b) => b.priceChangePercent - a.priceChangePercent,
    );
    const topGainer = sortedByGain[0];
    const secondGainer = sortedByGain[1];
    const topDrop = [...CROP_PRODUCTS].sort(
      (a, b) => a.priceChangePercent - b.priceChangePercent,
    )[0];

    const spreads = CROP_PRODUCTS.map((crop) => {
      const prices = crop.marketComparisons.map((m) => m.modalPrice);
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      return {crop, spread: max - min, max, min};
    }).sort((a, b) => b.spread - a.spread);

    const biggestSpread = spreads[0];
    const vegSpread = spreads.find((s) => s.crop.category === 'vegetable') || spreads[0];

    return [
      {
        id: 'ins-gain-1',
        category: 'weekly_trend',
        title: `${topGainer.name} leads 7-day price momentum`,
        metric: `+${topGainer.priceChangePercent}% · ₹${topGainer.modalPrice}/kg`,
        detail: `${topGainer.name} (${topGainer.variety}) recorded the strongest 7-day modal gain across ${topGainer.market}, followed by ${secondGainer.name} (+${secondGainer.priceChangePercent}%).`,
        cropId: topGainer.id,
      },
      {
        id: 'ins-spread-1',
        category: 'market_spread',
        title: `Widest APMC price spread in ${biggestSpread.crop.name}`,
        metric: `₹${biggestSpread.spread}/kg spread`,
        detail: `Listed modal rates for ${biggestSpread.crop.name} span from ₹${biggestSpread.min}/kg to ₹${biggestSpread.max}/kg across nearby Karnataka mandis. Compare crate transport cost before travelling further.`,
        cropId: biggestSpread.crop.id,
      },
      {
        id: 'ins-spread-veg',
        category: 'market_spread',
        title: `Top vegetable market difference: ${vegSpread.crop.name}`,
        metric: `₹${vegSpread.min}–₹${vegSpread.max}/kg`,
        detail: `Grade-A sorting and early morning mandi arrival help capture the upper end of the ${vegSpread.crop.name} modal range.`,
        cropId: vegSpread.crop.id,
      },
      {
        id: 'ins-drop-1',
        category: 'seasonal_watch',
        title: `Supply softening observed in ${topDrop.name}`,
        metric: `${topDrop.priceChangePercent}% · ₹${topDrop.modalPrice}/kg`,
        detail: `Increased arrivals softened ${topDrop.name} modal prices this week. Consider cured holding where storage life permits or direct retail lots.`,
        cropId: topDrop.id,
      },
    ];
  }
}

export const marketProvider: MarketDataProvider = new DemoMarketDataProvider();
