import {DailyBriefingResponse, LanguageCode} from '../types/krishi';

export interface GroundingSource {
  title: string;
  uri: string;
  kind: 'web' | 'maps';
}

export interface MandiGroundingResult {
  text: string;
  sources: GroundingSource[];
  mode: 'search' | 'maps';
  updatedAt: string;
}

export interface AdvisorResponse {
  answer: string;
  updatedAt: string;
}

export interface TtsResponse {
  audioBase64: string;
  mimeType: string;
}

export async function fetchMapsApiKey(): Promise<string> {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey) return envKey;
  try {
    const res = await fetch('/api/config/maps');
    if (!res.ok) return '';
    const data = (await res.json()) as {apiKey?: unknown};
    return typeof data.apiKey === 'string' ? data.apiKey : '';
  } catch {
    return '';
  }
}

export async function fetchDailyBriefing(params: {
  farmerName: string;
  locationId: string;
  state?: string;
  district?: string;
  taluk?: string;
  preferredMandi?: string;
  savedCropIds: string[];
  language: LanguageCode;
  forceRefresh?: boolean;
}): Promise<DailyBriefingResponse> {
  const res = await fetch('/api/ai/daily-briefing', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as DailyBriefingResponse & {error?: string};
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to prepare your personalized briefing right now.');
  }
  return data;
}

export async function fetchMandiGrounding(params: {
  cropName: string;
  marketName: string;
  locationName: string;
  mode: 'search' | 'maps';
  lat?: number;
  lng?: number;
  language: LanguageCode;
}): Promise<MandiGroundingResult> {
  const res = await fetch('/api/ai/mandi-grounding', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as MandiGroundingResult & {error?: string};
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to fetch live mandi intelligence.');
  }
  return data;
}

export async function askKrishiAdvisor(params: {
  question: string;
  farmerName?: string;
  cropContext?: Record<string, unknown>;
  weatherContext?: Record<string, unknown>;
  locationName: string;
  language: LanguageCode;
}): Promise<AdvisorResponse> {
  const res = await fetch('/api/ai/advisor', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as AdvisorResponse & {error?: string};
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to get advisor response.');
  }
  return data;
}

export async function fetchQuickSummary(params: {
  topic: string;
  payload: Record<string, unknown>;
  language: LanguageCode;
}): Promise<string> {
  const res = await fetch('/api/ai/quick-summary', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {summary?: unknown; error?: string};
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to generate summary.');
  }
  return String(data.summary || '');
}

export async function fetchTtsAudio(params: {
  text: string;
  language: LanguageCode;
}): Promise<TtsResponse> {
  const res = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as TtsResponse & {error?: string};
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to generate speech audio.');
  }
  return data;
}
