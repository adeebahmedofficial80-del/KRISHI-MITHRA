export type LanguageCode = 'en' | 'kn' | 'hi' | 'te' | 'ta';

export type CropCategory = 'vegetable' | 'fruit';

export type NavTab = 'home' | 'markets' | 'weather' | 'my-crops' | 'insights';

export interface PriceHistoryPoint {
  date: string;
  label: string;
  modal: number;
  min: number;
  max: number;
}

export interface MarketPriceEntry {
  marketId: string;
  marketName: string;
  district: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  trendPercent: number;
  arrivalDate: string;
  distanceKm?: number;
  priceType: 'Wholesale Mandi';
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
  image: string;
  unit: 'kg';
  currency: '₹';
  description: string;
  modalPrice: number;
  minimumPrice: number;
  maximumPrice: number;
  priceChangePercent: number;
  market: string;
  marketId: string;
  updatedAt: string;
  isDemo: boolean;
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
}

export interface WeatherAlertItem {
  id: string;
  type: 'rain' | 'heavy_rain' | 'wind' | 'heat' | 'humidity';
  severity: 'Low' | 'Moderate' | 'High';
  title: string;
  summary: string;
  action: string;
}

export interface FarmAdvisory {
  id: string;
  condition: string;
  priority: 'Low' | 'Moderate' | 'High';
  recommendation: string;
  reason: string;
  timeWindow: string;
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
  source: 'live' | 'demo';
  sourceLabel: string;
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
