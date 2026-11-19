import {GoogleGenAI} from '@google/genai';
import fs from 'fs';
import path from 'path';
import {CROP_CATALOG_META, matchAgmarknetCommodityToCropId} from '../data/cropCatalogMeta.ts';
import type {
  GroundedSourceRef,
  MarketDataSourceStatus,
  MarketFeedResponse,
  MarketPriceEntry,
  MarketPriceObservation,
  MarketSyncStatus,
  PriceHistoryPoint,
} from '../types/krishi.ts';

const CACHE_DIR = path.resolve(process.cwd(), '.krishi-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'gemini-market-history.json');

const FRESH_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours cache per crop+location
const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000; // Older than 36h marked stale
const MANUAL_SYNC_COOLDOWN_MS = 25 * 1000; // Prevent excessive Gemini calls
const MAX_CROPS_PER_BATCH = 6; // Keep grounded prompts crisp and accurate

interface StoredGroundedRecord {
  cropId: string;
  commodity: string;
  variety: string;
  state: string;
  district: string;
  market: string;
  observationDateIso: string; // YYYY-MM-DD or '' if unspecified
  observationDateLabel: string;
  measurementUnit: string;
  minPriceQuintal: number;
  maxPriceQuintal: number;
  modalPriceQuintal: number;
  minPriceKg: number;
  maxPriceKg: number;
  modalPriceKg: number;
  sourceName: string;
  sourceUrl: string;
  sourceUrls: GroundedSourceRef[];
  retrievedAt: string; // ISO timestamp
}

interface PersistedGroundedCache {
  lastSyncAt: string | null;
  lastError: string | null;
  quotaLimited: boolean;
  records: StoredGroundedRecord[];
}

interface RawGeminiObservation {
  cropId?: string;
  cropName?: string;
  variety?: string;
  market?: string;
  district?: string;
  state?: string;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  modalPrice?: number | string | null;
  unit?: string;
  observationDate?: string;
  sourceName?: string;
  sourceUrl?: string;
  verified?: boolean;
}

interface GroundingChunkLike {
  web?: {uri?: string; title?: string};
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parsePositiveNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function normalizeUnitToQuintalAndKg(
  rawMin: number | null,
  rawMax: number | null,
  rawModal: number,
  rawUnit?: string,
): {
  minPriceQuintal: number;
  maxPriceQuintal: number;
  modalPriceQuintal: number;
  minPriceKg: number;
  maxPriceKg: number;
  modalPriceKg: number;
  measurementUnit: string;
} | null {
  const unitText = (rawUnit || '').toLowerCase();
  const isPerKg =
    unitText.includes('kg') ||
    unitText.includes('kilogram') ||
    (!unitText.includes('quintal') && !unitText.includes('qtl') && rawModal < 300);

  let modalQuintal: number;
  let minQuintal: number;
  let maxQuintal: number;

  if (isPerKg) {
    // Realistic Indian wholesale produce kg bounds: ₹2/kg to ₹800/kg
    if (rawModal < 2 || rawModal > 800) return null;
    modalQuintal = Math.round(rawModal * 100);
    minQuintal = Math.round((rawMin ?? rawModal * 0.9) * 100);
    maxQuintal = Math.round((rawMax ?? rawModal * 1.1) * 100);
  } else {
    // Realistic quintal bounds: ₹200/qtl to ₹80,000/qtl
    if (rawModal < 200 || rawModal > 80000) return null;
    modalQuintal = Math.round(rawModal);
    minQuintal = Math.round(rawMin ?? rawModal * 0.9);
    maxQuintal = Math.round(rawMax ?? rawModal * 1.1);
  }

  // Ensure monotonic min <= modal <= max
  if (minQuintal > modalQuintal) minQuintal = modalQuintal;
  if (maxQuintal < modalQuintal) maxQuintal = modalQuintal;

  return {
    minPriceQuintal: minQuintal,
    maxPriceQuintal: maxQuintal,
    modalPriceQuintal: modalQuintal,
    minPriceKg: Number((minQuintal / 100).toFixed(2)),
    maxPriceKg: Number((maxQuintal / 100).toFixed(2)),
    modalPriceKg: Number((modalQuintal / 100).toFixed(2)),
    measurementUnit: isPerKg ? '₹/kg (₹/Quintal normalized)' : '₹/Quintal (₹/kg normalized)',
  };
}

function parseObservationDate(raw?: string): {iso: string; label: string} | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown' || trimmed.toLowerCase() === 'null') {
    return null;
  }

  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      const iso = d.toISOString().slice(0, 10);
      return {
        iso,
        label: d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }),
      };
    }
  }

  const ymd = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return {
        iso: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }),
      };
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() >= 2024) {
    return {
      iso: parsed.toISOString().slice(0, 10),
      label: parsed.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    };
  }

  return null;
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function extractJsonArrayFromText(rawText: string): RawGeminiObservation[] {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try parsing directly or finding JSON object/array block
  const candidates: string[] = [cleaned];
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) candidates.push(arrMatch[0]);
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) candidates.push(objMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as RawGeminiObservation[];
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        'observations' in parsed &&
        Array.isArray((parsed as {observations?: unknown}).observations)
      ) {
        return (parsed as {observations: RawGeminiObservation[]}).observations;
      }
    } catch {
      // Try next candidate
    }
  }
  return [];
}

function extractGroundingSources(response: unknown): GroundedSourceRef[] {
  const resObj = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: GroundingChunkLike[];
      };
    }>;
  };
  const chunks = resObj?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const refs: GroundedSourceRef[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    refs.push({
      title: chunk?.web?.title?.trim() || new URL(uri).hostname,
      url: uri,
    });
  }
  return refs;
}

function isQuotaOrBillingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('billing')
  );
}

class GeminiGroundedMarketService {
  private cache: PersistedGroundedCache = {
    lastSyncAt: null,
    lastError: null,
    quotaLimited: false,
    records: [],
  };
  private inFlight = new Map<string, Promise<MarketFeedResponse>>();
  private lastManualSyncMs = 0;

  constructor() {
    this.loadDiskCache();
  }

  private loadDiskCache(): void {
    try {
      if (!fs.existsSync(CACHE_FILE)) return;
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedGroundedCache;
      if (parsed && Array.isArray(parsed.records)) {
        this.cache = {
          lastSyncAt: parsed.lastSyncAt || null,
          lastError: parsed.lastError || null,
          quotaLimited: Boolean(parsed.quotaLimited),
          records: parsed.records.slice(-4000),
        };
      }
    } catch {
      // Start with empty cache if unreadable
    }
  }

  private saveDiskCache(): void {
    try {
      fs.mkdirSync(CACHE_DIR, {recursive: true});
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch {
      // Ignore write failures in read-only runtimes
    }
  }

  isGeminiConfigured(): boolean {
    return Boolean((process.env.GEMINI_API_KEY || '').trim());
  }

  getStatus(): MarketSyncStatus {
    const configured = this.isGeminiConfigured();
    const recordCount = this.cache.records.length;
    const matchedCrops = new Set(this.cache.records.map((r) => r.cropId));

    let latestObsDate: string | null = null;
    let latestRetrievedMs = 0;
    for (const r of this.cache.records) {
      if (r.observationDateIso && (!latestObsDate || r.observationDateIso > latestObsDate)) {
        latestObsDate = r.observationDateIso;
      }
      const ts = new Date(r.retrievedAt).getTime();
      if (Number.isFinite(ts) && ts > latestRetrievedMs) {
        latestRetrievedMs = ts;
      }
    }

    const ageMs = latestRetrievedMs > 0 ? Date.now() - latestRetrievedMs : Number.POSITIVE_INFINITY;
    const isStale = recordCount === 0 || ageMs > STALE_THRESHOLD_MS;

    let sourceStatus: MarketDataSourceStatus = 'unavailable';
    let sourceLabel = 'Gemini Google Search Grounding ready — select crops or tap Fetch Live Prices';
    let staleReason: string | null = null;

    if (!configured) {
      sourceStatus = 'unavailable';
      sourceLabel = 'Gemini API key unavailable on server';
      staleReason = 'GEMINI_API_KEY is not configured in the server environment.';
    } else if (recordCount > 0) {
      sourceStatus = ageMs <= FRESH_TTL_MS ? 'gemini_grounded' : 'cached_grounded';
      sourceLabel =
        sourceStatus === 'gemini_grounded'
          ? 'Live Market Prices via Gemini Google Search Grounding'
          : 'Cached Gemini-Grounded Market Prices';
      if (isStale) {
        staleReason = 'Stored market observations are over 36 hours old. Tap Refresh Live Prices to fetch current mandi reports.';
      }
    } else if (this.cache.lastError) {
      sourceStatus = 'unavailable';
      sourceLabel = 'Latest verified market price is currently unavailable.';
      staleReason = this.cache.lastError;
    }

    return {
      sourceStatus,
      sourceLabel,
      lastSyncAt: this.cache.lastSyncAt,
      observationDate: latestObsDate,
      recordCount,
      matchedCropCount: matchedCrops.size,
      isStale,
      staleReason,
      geminiSearchEnabled: configured,
      quotaLimited: this.cache.quotaLimited,
      missingCredentials: configured ? [] : ['GEMINI_API_KEY'],
      nextScheduledSyncAt: null,
    };
  }

  private isCropFreshInCache(cropId: string, state: string, district: string): boolean {
    const stateLower = state.toLowerCase();
    const districtLower = district.toLowerCase();
    const now = Date.now();
    return this.cache.records.some((r) => {
      if (r.cropId !== cropId) return false;
      const retrievedMs = new Date(r.retrievedAt).getTime();
      if (!Number.isFinite(retrievedMs) || now - retrievedMs > FRESH_TTL_MS) return false;
      return (
        r.state.toLowerCase() === stateLower ||
        r.district.toLowerCase() === districtLower ||
        !stateLower
      );
    });
  }

  async fetchGroundedMarketPrices(params: {
    cropIds: string[];
    state?: string;
    district?: string;
    preferredMandi?: string;
    forceRefresh?: boolean;
  }): Promise<MarketFeedResponse> {
    const ai = getAiClient();
    const state = (params.state || 'Karnataka').trim();
    const district = (params.district || 'Bengaluru Rural').trim();
    const preferredMandi = (params.preferredMandi || '').trim();

    if (!ai) {
      this.cache.lastError = 'GEMINI_API_KEY is not configured on the server.';
      return this.getMarketFeed({state, district, preferredMandi});
    }

    const normalizedCropIds = Array.from(
      new Set(
        params.cropIds
          .map((id) => id.trim().toLowerCase())
          .filter((id) => CROP_CATALOG_META.some((m) => m.id === id)),
      ),
    ).slice(0, MAX_CROPS_PER_BATCH);

    if (normalizedCropIds.length === 0) {
      return this.getMarketFeed({state, district, preferredMandi});
    }

    const cropsToQuery = params.forceRefresh
      ? normalizedCropIds
      : normalizedCropIds.filter((id) => !this.isCropFreshInCache(id, state, district));

    if (cropsToQuery.length === 0) {
      return this.getMarketFeed({state, district, preferredMandi});
    }

    if (
      params.forceRefresh &&
      !this.cache.lastError &&
      Date.now() - this.lastManualSyncMs < MANUAL_SYNC_COOLDOWN_MS
    ) {
      return this.getMarketFeed({state, district, preferredMandi});
    }

    const dedupeKey = `${state.toLowerCase()}|${district.toLowerCase()}|${cropsToQuery.slice().sort().join(',')}`;
    const existingFlight = this.inFlight.get(dedupeKey);
    if (existingFlight) {
      return existingFlight;
    }

    const promise = (async (): Promise<MarketFeedResponse> => {
      if (params.forceRefresh) {
        this.lastManualSyncMs = Date.now();
      }
      try {
        const cropListText = cropsToQuery
          .map((id) => {
            const meta = CROP_CATALOG_META.find((m) => m.id === id);
            return `${id} (${meta?.name || id}, e.g., ${(meta?.regionalNames || []).slice(0, 2).join('/')})`;
          })
          .join('; ');

        const todayIso = new Date().toISOString().slice(0, 10);
        const prompt = `Search online for the LATEST verified Indian wholesale agricultural mandi (APMC / eNAM / state marketing board / Agmarknet / reliable mandi portal) prices as close as possible to ${todayIso} for these crops in ${district}, ${state}${preferredMandi ? ` (prioritize ${preferredMandi} and nearby APMCs in ${state})` : ''}:
Crops: ${cropListText}

Prioritize:
1. Official state agricultural marketing & APMC portals (e.g., krishimaratavahini.kar.nic.in, enam.gov.in, agmarknet.gov.in, state horticulture/APMC boards).
2. Reliable Indian daily mandi price portals publishing recent wholesale rates with explicit arrival/observation dates.

STRICT DATA INTEGRITY RULES:
- NEVER invent, guess, or estimate prices or dates.
- If you cannot find a verified recent online price for a crop, omit it or set "verified": false with null prices.
- Report the ACTUAL observation/arrival date found in the online source (YYYY-MM-DD). Never label an older report as today's date.
- Preserve the exact unit from the source ("quintal" or "kg").

Return ONLY a JSON object in this exact shape (no markdown commentary outside the JSON):
{
  "observations": [
    {
      "cropId": "exact cropId from the list above",
      "cropName": "Tomato",
      "variety": "Hybrid / Local / Standard",
      "market": "Exact APMC or mandi name",
      "district": "District name",
      "state": "State name",
      "minPrice": 1800,
      "maxPrice": 2400,
      "modalPrice": 2100,
      "unit": "quintal",
      "observationDate": "YYYY-MM-DD",
      "sourceName": "Portal or APMC source name",
      "sourceUrl": "Exact URL if known",
      "verified": true
    }
  ]
}`;

        const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

        let response: unknown = null;
        let lastModelErr: unknown = null;
        for (const model of modelsToTry) {
          try {
            response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                tools: [{googleSearch: {}}],
              },
            });
            break;
          } catch (err: unknown) {
            lastModelErr = err;
            console.warn(
              `[marketService] Gemini Search grounding attempt (${model}) failed:`,
              err instanceof Error ? err.message.slice(0, 220) : String(err),
            );
          }
        }
        if (!response) {
          throw lastModelErr || new Error('Gemini Search grounding failed across all models.');
        }

        const resText =
          (response as {text?: string})?.text && typeof (response as {text?: string}).text === 'string'
            ? (response as {text: string}).text
            : '';

        const groundingSources = extractGroundingSources(response);
        const rawObservations = extractJsonArrayFromText(resText);
        const retrievedAt = new Date().toISOString();

        const validNewRecords: StoredGroundedRecord[] = [];
        for (const item of rawObservations) {
          if (item.verified === false) continue;

          const matchedId =
            (item.cropId && CROP_CATALOG_META.some((m) => m.id === item.cropId)
              ? item.cropId
              : null) ||
            (item.cropName ? matchAgmarknetCommodityToCropId(item.cropName) : null);

          if (!matchedId) continue;

          const modalNum = parsePositiveNumber(item.modalPrice);
          if (!modalNum) continue;

          const minNum = parsePositiveNumber(item.minPrice);
          const maxNum = parsePositiveNumber(item.maxPrice);
          const normalized = normalizeUnitToQuintalAndKg(minNum, maxNum, modalNum, item.unit);
          if (!normalized) continue;

          const parsedDate = parseObservationDate(item.observationDate);
          const meta = CROP_CATALOG_META.find((m) => m.id === matchedId);

          // Always prefer verified groundingChunks URLs over model-printed URLs
          const primarySource = groundingSources[0];
          const verifiedUrl =
            primarySource?.url ||
            (typeof item.sourceUrl === 'string' && /^https?:\/\//i.test(item.sourceUrl.trim())
              ? item.sourceUrl.trim()
              : '');

          // Require at least a grounded web citation or explicit verified source name
          const sourceName =
            primarySource?.title ||
            (typeof item.sourceName === 'string' && item.sourceName.trim()) ||
            'Online Mandi Report (Gemini Search)';

          if (!verifiedUrl && groundingSources.length === 0) {
            continue;
          }

          validNewRecords.push({
            cropId: matchedId,
            commodity: meta?.name || item.cropName || matchedId,
            variety:
              typeof item.variety === 'string' && item.variety.trim()
                ? item.variety.trim().slice(0, 60)
                : meta?.defaultVariety || 'Standard',
            state:
              typeof item.state === 'string' && item.state.trim()
                ? item.state.trim().slice(0, 60)
                : state,
            district:
              typeof item.district === 'string' && item.district.trim()
                ? item.district.trim().slice(0, 60)
                : district,
            market:
              typeof item.market === 'string' && item.market.trim()
                ? item.market.trim().slice(0, 80)
                : preferredMandi || `${district} APMC`,
            observationDateIso: parsedDate?.iso || retrievedAt.slice(0, 10),
            observationDateLabel:
              parsedDate?.label ||
              `Reported (retrieved ${new Date(retrievedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })})`,
            measurementUnit: normalized.measurementUnit,
            minPriceQuintal: normalized.minPriceQuintal,
            maxPriceQuintal: normalized.maxPriceQuintal,
            modalPriceQuintal: normalized.modalPriceQuintal,
            minPriceKg: normalized.minPriceKg,
            maxPriceKg: normalized.maxPriceKg,
            modalPriceKg: normalized.modalPriceKg,
            sourceName,
            sourceUrl: verifiedUrl,
            sourceUrls: groundingSources.slice(0, 5),
            retrievedAt,
          });
        }

        if (validNewRecords.length > 0) {
          this.mergeIntoArchive(validNewRecords);
          this.cache.lastError = null;
          this.cache.quotaLimited = false;
        } else {
          this.cache.lastError =
            'Latest verified market price is currently unavailable from online sources for the requested crops.';
        }

        this.cache.lastSyncAt = retrievedAt;
        this.saveDiskCache();
        return this.getMarketFeed({state, district, preferredMandi});
      } catch (err: unknown) {
        this.cache.quotaLimited = isQuotaOrBillingError(err);
        this.cache.lastError = this.cache.quotaLimited
          ? 'Gemini Search grounding quota or billing limit was reached. Cached observations remain available.'
          : 'Unable to retrieve verified online market prices right now.';
        this.cache.lastSyncAt = new Date().toISOString();
        this.saveDiskCache();
        return this.getMarketFeed({state, district, preferredMandi});
      } finally {
        this.inFlight.delete(dedupeKey);
      }
    })();

    this.inFlight.set(dedupeKey, promise);
    return promise;
  }

  private mergeIntoArchive(incoming: StoredGroundedRecord[]): void {
    const map = new Map<string, StoredGroundedRecord>();
    for (const r of this.cache.records) {
      const key = `${r.cropId}|${r.state.toLowerCase()}|${r.market.toLowerCase()}|${r.observationDateIso}`;
      map.set(key, r);
    }
    for (const r of incoming) {
      const key = `${r.cropId}|${r.state.toLowerCase()}|${r.market.toLowerCase()}|${r.observationDateIso}`;
      map.set(key, r);
    }
    const merged = Array.from(map.values()).sort((a, b) =>
      b.retrievedAt.localeCompare(a.retrievedAt),
    );
    this.cache.records = merged.slice(0, 4000);
  }

  getMarketFeed(params: {
    state?: string;
    district?: string;
    preferredMandi?: string;
  }): MarketFeedResponse {
    const status = this.getStatus();
    const observations: Record<string, MarketPriceObservation> = {};

    if (this.cache.records.length === 0) {
      return {status, observations};
    }

    const stateLower = (params.state || '').trim().toLowerCase();
    const districtLower = (params.district || '').trim().toLowerCase();
    const mandiLower = (params.preferredMandi || '').trim().toLowerCase();

    const byCrop = new Map<string, StoredGroundedRecord[]>();
    for (const r of this.cache.records) {
      const list = byCrop.get(r.cropId) || [];
      list.push(r);
      byCrop.set(r.cropId, list);
    }

    for (const [cropId, records] of byCrop.entries()) {
      const score = (r: StoredGroundedRecord): number => {
        let s = 0;
        if (mandiLower && r.market.toLowerCase().includes(mandiLower)) s += 100;
        if (districtLower && r.district.toLowerCase().includes(districtLower)) s += 50;
        if (stateLower && r.state.toLowerCase() === stateLower) s += 25;
        return s;
      };

      const sorted = [...records].sort((a, b) => {
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        if (b.observationDateIso !== a.observationDateIso) {
          return b.observationDateIso.localeCompare(a.observationDateIso);
        }
        return b.retrievedAt.localeCompare(a.retrievedAt);
      });

      const primary = sorted[0];
      const ageMs = Date.now() - new Date(primary.retrievedAt).getTime();
      const recordStatus: MarketDataSourceStatus =
        ageMs <= FRESH_TTL_MS ? 'gemini_grounded' : 'cached_grounded';

      // Comparable prior-day observation (same crop & state, strictly earlier observationDateIso)
      const prior = sorted.find(
        (r) =>
          r.observationDateIso < primary.observationDateIso &&
          r.state.toLowerCase() === primary.state.toLowerCase(),
      );

      let previousComparableModalKg: number | null = null;
      let priceChangeAbsoluteKg: number | null = null;
      let priceChangePercent: number | null = null;

      if (prior && prior.modalPriceKg > 0) {
        previousComparableModalKg = prior.modalPriceKg;
        priceChangeAbsoluteKg = Number((primary.modalPriceKg - prior.modalPriceKg).toFixed(2));
        priceChangePercent = Number(
          (((primary.modalPriceKg - prior.modalPriceKg) / prior.modalPriceKg) * 100).toFixed(1),
        );
      }

      // Build distinct-date history points from archived grounded observations
      const byDate = new Map<string, StoredGroundedRecord>();
      for (const r of sorted) {
        if (!byDate.has(r.observationDateIso)) {
          byDate.set(r.observationDateIso, r);
        }
      }
      const history7d: PriceHistoryPoint[] = Array.from(byDate.values())
        .sort((a, b) => a.observationDateIso.localeCompare(b.observationDateIso))
        .slice(-7)
        .map((r) => ({
          date: r.observationDateIso,
          label: r.observationDateLabel,
          modal: r.modalPriceKg,
          min: r.minPriceKg,
          max: r.maxPriceKg,
          modalQuintal: r.modalPriceQuintal,
        }));

      // Build market comparison entries from distinct mandis in archive
      const byMarket = new Map<string, StoredGroundedRecord>();
      for (const r of sorted) {
        const mk = r.market.toLowerCase();
        if (!byMarket.has(mk)) byMarket.set(mk, r);
      }
      const comparisons: MarketPriceEntry[] = Array.from(byMarket.values())
        .slice(0, 6)
        .map((r) => ({
          marketId: slugify(r.market),
          marketName: r.market,
          district: r.district,
          state: r.state,
          modalPrice: r.modalPriceKg,
          minPrice: r.minPriceKg,
          maxPrice: r.maxPriceKg,
          modalPriceQuintal: r.modalPriceQuintal,
          minPriceQuintal: r.minPriceQuintal,
          maxPriceQuintal: r.maxPriceQuintal,
          trendPercent: null,
          arrivalDate: r.observationDateLabel,
          priceType: 'Wholesale Mandi',
          dataSource: recordStatus,
          sourceName: r.sourceName,
          sourceUrl: r.sourceUrl,
        }));

      observations[cropId] = {
        cropId,
        commodity: primary.commodity,
        variety: primary.variety,
        state: primary.state,
        district: primary.district,
        market: primary.market,
        arrivalDate: primary.observationDateLabel,
        measurementUnit: primary.measurementUnit,
        minPriceQuintal: primary.minPriceQuintal,
        maxPriceQuintal: primary.maxPriceQuintal,
        modalPriceQuintal: primary.modalPriceQuintal,
        minPriceKg: primary.minPriceKg,
        maxPriceKg: primary.maxPriceKg,
        modalPriceKg: primary.modalPriceKg,
        previousComparableModalKg,
        priceChangeAbsoluteKg,
        priceChangePercent,
        sourceStatus: recordStatus,
        sourceName: primary.sourceName,
        sourceUrl: primary.sourceUrl,
        sourceUrls: primary.sourceUrls,
        retrievedAt: primary.retrievedAt,
        history7d,
        comparisons,
      };
    }

    return {status, observations};
  }
}

export const marketService = new GeminiGroundedMarketService();
