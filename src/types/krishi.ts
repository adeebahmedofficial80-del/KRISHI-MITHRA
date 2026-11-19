export type LanguageCode = 'en' | 'kn' | 'hi' | 'te' | 'ta';

export type CropCategory = 'vegetable' | 'fruit';

export type NavTab = 'home' | 'markets' | 'weather' | 'my-crops' | 'insights';

export type PriceDisplayUnit = 'kg' | 'quintal';

export type MarketDataSourceStatus =
  | 'live_agmarknet'
  | 'cached_agmarknet'
  | 'catalog_reference';

export type WeatherAdvisorySourceType =
  | 'official_imd'
  | 'weather_derived'
  | 'crop_suggestion';

export interface PriceHistoryPoint {
  date: string;
  label: string;
  modal: number;
  min: number;
  max: number;
  modalQuintal?: number;
}

export interface MarketPriceEntry {
  marketId: string;
  marketName: string;
  district: string;
  state?: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  modalPriceQuintal?: number;
  minPriceQuintal?: number;
  maxPriceQuintal?: number;
  trendPercent: number | null;
  arrivalDate: string;
  distanceKm?: number;
  priceType: 'Wholesale Mandi';
  dataSource?: MarketDataSourceStatus;
}

export interface NutritionProfile {
  energyKcal: number;
  waterPercent: number;
  carbsG: number;
  proteinG: number;
  fiberG: number;
  fatG: number;
  vitaminCMg?: number;
  vitaminAUg?: number;
  potassiumMg?: number;
  calciumMg?: number;
}

export interface CropInfo {
  growingSeason: string;
  climate: string;
  waterRequirements: string;
  soil: string;
  harvesting: string;
  postHarvest: string;
  transport: string;
}

export interface SeasonalityInfo {
  monsoon: boolean;
  winter: boolean;
  summer: boolean;
  regionLabel: string;
  harvestPeriod: string;
  marketNote: string;
}

export interface CropProduct {
  id: string;
  name: string;
  category: CropCategory;
  variety: string;
  varieties?: string[];
  regionalNames?: string[];
  image: string;
  unit: 'kg';
  currency: '₹';
  description: string;
  modalPrice: number;
  minimumPrice: number;
  maximumPrice: number;
  modalPriceQuintal?: number;
  minimumPriceQuintal?: number;
  maximumPriceQuintal?: number;
  priceChangePercent: number;
  priceChangeAbsolute?: number | null;
  previousComparablePrice?: number | null;
  hasComparableHistory?: boolean;
  market: string;
  marketId: string;
  marketState?: string;
  marketDistrict?: string;
  updatedAt: string;
  observationDate?: string;
  isDemo: boolean;
  dataSource?: MarketDataSourceStatus;
  isStale?: boolean;
  priceHistory: {
    '7d': PriceHistoryPoint[];
    '30d': PriceHistoryPoint[];
    '90d': PriceHistoryPoint[];
  };
  marketComparisons: MarketPriceEntry[];
  nutrition: NutritionProfile;
  cropInfo: CropInfo;
  marketQuality: string[];
  storage: string;
  shelfLife: string;
  conditionsToAvoid: string;
  seasonality: SeasonalityInfo;
  farmerInsights: string[];
  relatedCropIds: string[];
}

export interface LocationOption {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  taluks: string[];
  mandis: string[];
}

export interface MarketCenter {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  distanceFromBengaluruKm?: number;
}

export interface ForecastDay {
  date: string;
  dayLabel: string;
  minTemp: number;
  maxTemp: number;
  condition: 'Sunny' | 'Mostly sunny' | 'Partly cloudy' | 'Cloudy' | 'Light rain' | 'Rain showers';
  rainProbability: number;
  rainfallMm: number;
  humidity: number;
  windSpeedMax?: number;
}

export interface WeatherAlertItem {
  id: string;
  type: 'rain' | 'heavy_rain' | 'wind' | 'heat' | 'humidity';
  severity: 'Low' | 'Moderate' | 'High';
  title: string;
  summary: string;
  action: string;
  sourceType?: WeatherAdvisorySourceType;
  issuedAt?: string;
}

export interface FarmAdvisory {
  id: string;
  condition: string;
  priority: 'Low' | 'Moderate' | 'High';
  recommendation: string;
  reason: string;
  timeWindow: string;
  sourceType?: WeatherAdvisorySourceType;
  relatedCropIds?: string[];
}

export interface WeatherSnapshot {
  locationId: string;
  locationName: string;
  currentTemperature: number;
  feelsLike: number;
  condition: ForecastDay['condition'];
  humidity: number;
  windSpeed: number;
  windDirection: string;
  rainProbability: number;
  sunrise: string;
  sunset: string;
  source: 'live' | 'cached' | 'demo';
  sourceLabel: string;
  officialProvider: 'imd_and_open_meteo' | 'open_meteo' | 'cached_open_meteo';
  isStale?: boolean;
  staleReason?: string;
  observedAtIso?: string;
  updatedAt: string;
  forecast: ForecastDay[];
  alerts: WeatherAlertItem[];
  advisories: FarmAdvisory[];
}

export interface PriceAlert {
  id: string;
  cropId: string;
  targetPrice: number;
  condition: 'above' | 'below';
  channel: 'app' | 'sms_demo' | 'whatsapp_demo';
  enabled: boolean;
  createdAt: string;
}

export interface FarmNote {
  id: string;
  title: string;
  content: string;
  cropId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeatherAlertPrefs {
  rain: boolean;
  heavyRain: boolean;
  temperature: boolean;
  wind: boolean;
  dailyForecast: boolean;
}

export interface FarmerProfile {
  uid: string;
  farmerName: string;
  email: string;
  state: string;
  district: string;
  taluk: string;
  preferredMandi: string;
  selectedLocationId: string;
  selectedLanguage: LanguageCode;
  favoriteCropIds: string[];
  savedVegetableIds: string[];
  savedFruitIds: string[];
  alertPrefs: WeatherAlertPrefs;
  onboardingCompleted: boolean;
  hasSeenGrandOpening: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
}

export interface MarketSyncStatus {
  sourceStatus: MarketDataSourceStatus;
  sourceLabel: string;
  lastSyncAt: string | null;
  observationDate: string | null;
  recordCount: number;
  matchedCropCount: number;
  isStale: boolean;
  staleReason: string | null;
  agmarknetConfigured: boolean;
  missingCredentials: string[];
  nextScheduledSyncAt: string | null;
}

export interface MarketPriceObservation {
  cropId: string;
  commodity: string;
  variety: string;
  state: string;
  district: string;
  market: string;
  arrivalDate: string;
  minPriceQuintal: number;
  maxPriceQuintal: number;
  modalPriceQuintal: number;
  minPriceKg: number;
  maxPriceKg: number;
  modalPriceKg: number;
  previousComparableModalKg: number | null;
  priceChangeAbsoluteKg: number | null;
  priceChangePercent: number | null;
  sourceStatus: MarketDataSourceStatus;
  history7d: PriceHistoryPoint[];
  comparisons: MarketPriceEntry[];
}

export interface MarketFeedResponse {
  status: MarketSyncStatus;
  observations: Record<string, MarketPriceObservation>;
}

export interface DailyBriefingResponse {
  briefingText: string;
  audioBase64: string | null;
  mimeType: string | null;
  cached: boolean;
  generatedAt: string;
  audioError?: string | null;
  dataSources: {
    marketStatus: MarketDataSourceStatus;
    marketObservationDate: string | null;
    weatherSource: string;
    weatherUpdatedAt: string | null;
  };
}
