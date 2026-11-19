import fs from 'fs';
import path from 'path';
import {CROP_CATALOG_META, matchAgmarknetCommodityToCropId} from '../data/cropCatalogMeta';
import {
  MarketDataSourceStatus,
  MarketFeedResponse,
  MarketPriceEntry,
  MarketPriceObservation,
  MarketSyncStatus,
  PriceHistoryPoint,
} from '../types/krishi';

const CACHE_DIR = path.resolve(process.cwd(), '.krishi-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'market-history.json');

const DEFAULT_DATA_GOV_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // Check every 6 hours
const MANUAL_SYNC_COOLDOWN_MS = 60 * 1000; // Prevent hammering AGMARKNET
const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000; // Older than 36h is stale

interface RawAgmarknetRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  grade?: string;
  arrival_date?: string;
  min_price?: string | number;
  max_price?: string | number;
  modal_price?: string | number;
}

interface StoredObservationRecord {
  cropId: string;
  commodity: string;
  variety: string;
  state: string;
  district: string;
  market: string;
  arrivalDateIso: string; // YYYY-MM-DD
  arrivalDateLabel: string;
  minPriceQuintal: number;
  maxPriceQuintal: number;
  modalPriceQuintal: number;
  minPriceKg: number;
  maxPriceKg: number;
  modalPriceKg: number;
  syncedAt: string;
}

interface PersistedMarketCache {
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  records: StoredObservationRecord[];
}

function parseArrivalDate(raw?: string): {iso: string; label: string} | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // AGMARKNET typically uses DD/MM/YYYY or YYYY-MM-DD
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
      return {iso, label};
    }
  }
  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
      return {iso, label};
    }
  }
  return null;
}

function parsePositiveNumber(val: unknown): number | null {
  const num = typeof val === 'number' ? val : Number(String(val ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function toKgFromQuintal(quintal: number): number {
  return Number((quintal / 100).toFixed(2));
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

class AgmarknetMarketService {
  private cache: PersistedMarketCache = {
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    lastError: null,
    records: [],
  };
  private inFlightSync: Promise<MarketSyncStatus> | null = null;
  private lastManualAttemptMs = 0;
  private schedulerHandle: NodeJS.Timeout | null = null;
  private nextScheduledSyncAt: string | null = null;

  constructor() {
    this.loadDiskCache();
  }

  private getApiKey(): string {
    return (process.env.DATA_GOV_IN_API_KEY || '').trim();
  }

  private getResourceId(): string {
    return (process.env.DATA_GOV_IN_RESOURCE_ID || DEFAULT_DATA_GOV_RESOURCE_ID).trim();
  }

  private loadDiskCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedMarketCache>;
        if (Array.isArray(parsed.records)) {
          this.cache = {
            lastSyncAt: parsed.lastSyncAt ?? null,
            lastSuccessfulSyncAt: parsed.lastSuccessfulSyncAt ?? null,
            lastError: parsed.lastError ?? null,
            records: parsed.records,
          };
        }
      }
    } catch (err) {
      console.warn('Market disk cache unavailable; starting fresh:', err);
    }
  }

  private saveDiskCache(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, {recursive: true});
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Unable to persist market disk cache:', err);
    }
  }

  public startDailyScheduler(): void {
    if (this.schedulerHandle) return;
    const scheduleNext = () => {
      this.nextScheduledSyncAt = new Date(Date.now() + SYNC_INTERVAL_MS).toISOString();
    };
    scheduleNext();

    // Trigger an initial background sync on startup if API key is configured and cache is empty/stale
    if (this.getApiKey()) {
      const lastOk = this.cache.lastSuccessfulSyncAt
        ? Date.parse(this.cache.lastSuccessfulSyncAt)
        : 0;
      if (!lastOk || Date.now() - lastOk > 12 * 60 * 60 * 1000) {
        void this.syncFromAgmarknet({force: false});
      }
    }

    this.schedulerHandle = setInterval(() => {
      scheduleNext();
      if (this.getApiKey()) {
        void this.syncFromAgmarknet({force: false});
      }
    }, SYNC_INTERVAL_MS);
    this.schedulerHandle.unref?.();
  }

  public async syncFromAgmarknet(options: {
    state?: string;
    force?: boolean;
  } = {}): Promise<MarketSyncStatus> {
    if (this.inFlightSync) {
      return this.inFlightSync;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return this.getStatus();
    }

    const now = Date.now();
    if (options.force && now - this.lastManualAttemptMs < MANUAL_SYNC_COOLDOWN_MS) {
      return this.getStatus();
    }
    this.lastManualAttemptMs = now;

    this.inFlightSync = (async () => {
      const syncedAt = new Date().toISOString();
      this.cache.lastSyncAt = syncedAt;
      try {
        const resourceId = this.getResourceId();
        const url = new URL(`https://api.data.gov.in/resource/${encodeURIComponent(resourceId)}`);
        url.searchParams.set('api-key', apiKey);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '1000');
        if (options.state && options.state.trim()) {
          url.searchParams.set('filters[state]', options.state.trim());
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {Accept: 'application/json'},
        });
        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`AGMARKNET API responded with HTTP ${res.status}`);
        }

        const payload = (await res.json()) as {records?: RawAgmarknetRecord[]};
        const rawRecords = Array.isArray(payload.records) ? payload.records : [];

        const normalizedNew: StoredObservationRecord[] = [];
        for (const rec of rawRecords) {
          const commodity = (rec.commodity || '').trim();
          const cropId = matchAgmarknetCommodityToCropId(commodity);
          if (!cropId) continue;

          const parsedDate = parseArrivalDate(rec.arrival_date);
          const modalQ = parsePositiveNumber(rec.modal_price);
          if (!parsedDate || !modalQ) continue;

          const minQ = parsePositiveNumber(rec.min_price) ?? modalQ;
          const maxQ = parsePositiveNumber(rec.max_price) ?? modalQ;
          const market = (rec.market || 'APMC Mandi').trim();
          const district = (rec.district || '').trim();
          const state = (rec.state || '').trim();
          const variety = (rec.variety || 'Standard').trim();

          normalizedNew.push({
            cropId,
            commodity,
            variety,
            state,
            district,
            market,
            arrivalDateIso: parsedDate.iso,
            arrivalDateLabel: parsedDate.label,
            minPriceQuintal: Math.round(minQ),
            maxPriceQuintal: Math.round(maxQ),
            modalPriceQuintal: Math.round(modalQ),
            minPriceKg: toKgFromQuintal(minQ),
            maxPriceKg: toKgFromQuintal(maxQ),
            modalPriceKg: toKgFromQuintal(modalQ),
            syncedAt,
          });
        }

        // Merge and deduplicate by (cropId, state, district, market, variety, arrivalDateIso)
        // Retain up to 90 days of history for accurate comparable day-over-day movement
        const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        const dedupeMap = new Map<string, StoredObservationRecord>();
        for (const existing of this.cache.records) {
          if (existing.arrivalDateIso >= cutoffDate) {
            const key = `${existing.cropId}|${existing.state}|${existing.market}|${existing.variety}|${existing.arrivalDateIso}`.toLowerCase();
            dedupeMap.set(key, existing);
          }
        }
        for (const item of normalizedNew) {
          const key = `${item.cropId}|${item.state}|${item.market}|${item.variety}|${item.arrivalDateIso}`.toLowerCase();
          dedupeMap.set(key, item);
        }

        this.cache.records = Array.from(dedupeMap.values()).sort((a, b) =>
          b.arrivalDateIso.localeCompare(a.arrivalDateIso),
        );
        this.cache.lastSuccessfulSyncAt = syncedAt;
        this.cache.lastError = null;
        this.saveDiskCache();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'AGMARKNET sync failed';
        this.cache.lastError = message;
        console.error('AGMARKNET sync error:', message);
      } finally {
        this.inFlightSync = null;
      }

      return this.getStatus();
    })();

    return this.inFlightSync;
  }

  public getStatus(): MarketSyncStatus {
    const apiKeyConfigured = Boolean(this.getApiKey());
    const missingCredentials = apiKeyConfigured ? [] : ['DATA_GOV_IN_API_KEY'];

    const latestObsDate = this.cache.records[0]?.arrivalDateIso ?? null;
    const matchedCropIds = new Set(this.cache.records.map((r) => r.cropId));

    let sourceStatus: MarketDataSourceStatus = 'catalog_reference';
    let isStale = true;
    let staleReason: string | null = null;
    let sourceLabel = 'Reference baseline (AGMARKNET API key not configured)';

    if (this.cache.records.length > 0 && this.cache.lastSuccessfulSyncAt) {
      const ageMs = Date.now() - Date.parse(this.cache.lastSuccessfulSyncAt);
      const isFresh = ageMs <= STALE_THRESHOLD_MS && !this.cache.lastError;
      sourceStatus = isFresh ? 'live_agmarknet' : 'cached_agmarknet';
      isStale = !isFresh;
      staleReason = isFresh
        ? null
        : this.cache.lastError
          ? `Last live AGMARKNET sync failed (${this.cache.lastError}); showing last verified cached data.`
          : 'Cached AGMARKNET records are older than 36 hours.';
      sourceLabel = isFresh
        ? 'Live AGMARKNET (data.gov.in)'
        : 'Cached AGMARKNET (data.gov.in)';
    } else if (apiKeyConfigured) {
      sourceStatus = 'catalog_reference';
      isStale = true;
      staleReason = this.cache.lastError
        ? `AGMARKNET sync failed (${this.cache.lastError}). Displaying reference baseline.`
        : 'Awaiting first AGMARKNET daily sync. Click Refresh Prices to fetch live mandi data.';
      sourceLabel = 'AGMARKNET configured — awaiting sync';
    } else {
      staleReason =
        'DATA_GOV_IN_API_KEY is not configured on the server. Displaying clearly labeled catalog reference baselines until live AGMARKNET credentials are set.';
    }

    return {
      sourceStatus,
      sourceLabel,
      lastSyncAt: this.cache.lastSuccessfulSyncAt,
      observationDate: latestObsDate,
      recordCount: this.cache.records.length,
      matchedCropCount: matchedCropIds.size,
      isStale,
      staleReason,
      agmarknetConfigured: apiKeyConfigured,
      missingCredentials,
      nextScheduledSyncAt: this.nextScheduledSyncAt,
    };
  }

  public getMarketFeed(filters: {
    state?: string;
    district?: string;
    preferredMandi?: string;
  } = {}): MarketFeedResponse {
    const status = this.getStatus();
    const observations: Record<string, MarketPriceObservation> = {};

    if (this.cache.records.length === 0) {
      return {status, observations};
    }

    const normState = (filters.state || '').trim().toLowerCase();
    const normDistrict = (filters.district || '').trim().toLowerCase();
    const normMandi = (filters.preferredMandi || '').trim().toLowerCase();

    const byCrop = new Map<string, StoredObservationRecord[]>();
    for (const rec of this.cache.records) {
      const list = byCrop.get(rec.cropId) ?? [];
      list.push(rec);
      byCrop.set(rec.cropId, list);
    }

    for (const meta of CROP_CATALOG_META) {
      const records = byCrop.get(meta.id);
      if (!records || records.length === 0) continue;

      // Score records by locality relevance (preferred mandi > district > state > latest date)
      const scored = [...records].sort((a, b) => {
        const score = (r: StoredObservationRecord) => {
          let s = 0;
          if (normMandi && r.market.toLowerCase().includes(normMandi)) s += 40;
          if (normDistrict && r.district.toLowerCase().includes(normDistrict)) s += 25;
          if (normState && r.state.toLowerCase() === normState) s += 15;
          return s;
        };
        const dateDiff = b.arrivalDateIso.localeCompare(a.arrivalDateIso);
        const sDiff = score(b) - score(a);
        // Prefer latest date first if within 2 days, else prefer higher locality score
        if (sDiff !== 0) return sDiff;
        return dateDiff;
      });

      const primary = scored[0];

      // Find strictly comparable prior observation: SAME cropId, market, variety, DIFFERENT earlier date
      const priorComparable = records.find(
        (r) =>
          r.arrivalDateIso < primary.arrivalDateIso &&
          r.market.toLowerCase() === primary.market.toLowerCase() &&
          r.variety.toLowerCase() === primary.variety.toLowerCase(),
      );

      let priceChangeAbsoluteKg: number | null = null;
      let priceChangePercent: number | null = null;
      if (priorComparable && priorComparable.modalPriceKg > 0) {
        priceChangeAbsoluteKg = Number(
          (primary.modalPriceKg - priorComparable.modalPriceKg).toFixed(2),
        );
        priceChangePercent = Number(
          (((primary.modalPriceKg - priorComparable.modalPriceKg) / priorComparable.modalPriceKg) * 100).toFixed(1),
        );
      }

      // Build verified history for this crop/market/variety
      const sameSeries = records
        .filter(
          (r) =>
            r.market.toLowerCase() === primary.market.toLowerCase() &&
            r.variety.toLowerCase() === primary.variety.toLowerCase(),
        )
        .sort((a, b) => a.arrivalDateIso.localeCompare(b.arrivalDateIso))
        .slice(-7);

      const history7d: PriceHistoryPoint[] = sameSeries.map((r) => ({
        date: r.arrivalDateIso,
        label: r.arrivalDateLabel.replace(/\s+\d{4}$/, ''),
        modal: r.modalPriceKg,
        min: r.minPriceKg,
        max: r.maxPriceKg,
        modalQuintal: r.modalPriceQuintal,
      }));

      // Build verified market comparisons across distinct mandis on the latest date available for each mandi
      const mandiMap = new Map<string, StoredObservationRecord>();
      for (const r of scored) {
        const mKey = `${r.market}|${r.district}`.toLowerCase();
        if (!mandiMap.has(mKey)) {
          mandiMap.set(mKey, r);
        }
        if (mandiMap.size >= 8) break;
      }

      const comparisons: MarketPriceEntry[] = Array.from(mandiMap.values()).map((r) => {
        const prevForMandi = records.find(
          (p) =>
            p.arrivalDateIso < r.arrivalDateIso &&
            p.market.toLowerCase() === r.market.toLowerCase() &&
            p.variety.toLowerCase() === r.variety.toLowerCase(),
        );
        const trendPct =
          prevForMandi && prevForMandi.modalPriceKg > 0
            ? Number(
                (((r.modalPriceKg - prevForMandi.modalPriceKg) / prevForMandi.modalPriceKg) * 100).toFixed(1),
              )
            : null;
        return {
          marketId: slugify(`${r.market}-${r.district}`),
          marketName: r.market,
          district: r.district || r.state,
          state: r.state,
          modalPrice: r.modalPriceKg,
          minPrice: r.minPriceKg,
          maxPrice: r.maxPriceKg,
          modalPriceQuintal: r.modalPriceQuintal,
          minPriceQuintal: r.minPriceQuintal,
          maxPriceQuintal: r.maxPriceQuintal,
          trendPercent: trendPct,
          arrivalDate: r.arrivalDateLabel,
          priceType: 'Wholesale Mandi',
          dataSource: status.sourceStatus,
        };
      });

      observations[meta.id] = {
        cropId: meta.id,
        commodity: primary.commodity,
        variety: primary.variety,
        state: primary.state,
        district: primary.district,
        market: primary.market,
        arrivalDate: primary.arrivalDateLabel,
        minPriceQuintal: primary.minPriceQuintal,
        maxPriceQuintal: primary.maxPriceQuintal,
        modalPriceQuintal: primary.modalPriceQuintal,
        minPriceKg: primary.minPriceKg,
        maxPriceKg: primary.maxPriceKg,
        modalPriceKg: primary.modalPriceKg,
        previousComparableModalKg: priorComparable?.modalPriceKg ?? null,
        priceChangeAbsoluteKg,
        priceChangePercent,
        sourceStatus: status.sourceStatus,
        history7d,
        comparisons,
      };
    }

    return {status, observations};
  }
}

export const marketService = new AgmarknetMarketService();
