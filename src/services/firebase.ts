import {initializeApp} from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {FarmNote, LanguageCode, PriceAlert, WeatherAlertPrefs} from '../types/krishi';

const app = initializeApp(firebaseConfig);
const configuredDbId = (firebaseConfig as {firestoreDatabaseId?: string}).firestoreDatabaseId;
export const db = configuredDbId ? getFirestore(app, configuredDbId) : getFirestore(app);
export const auth = getAuth(app);

let cachedOAuthAccessToken: string | null = null;

export function getOAuthAccessToken(): string | null {
  return cachedOAuthAccessToken;
}

export function clearOAuthAccessToken(): void {
  cachedOAuthAccessToken = null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

export async function signInWithGoogle(includeWorkspaceScopes = false): Promise<{
  user: User;
  accessToken: string | null;
}> {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  if (includeWorkspaceScopes) {
    for (const scope of WORKSPACE_SCOPES) {
      provider.addScope(scope);
    }
    provider.setCustomParameters({prompt: 'consent'});
  }
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedOAuthAccessToken = credential.accessToken;
  }
  return {
    user: result.user,
    accessToken: cachedOAuthAccessToken,
  };
}

export async function signOutUser(): Promise<void> {
  clearOAuthAccessToken();
  await firebaseSignOut(auth);
}

export interface CloudPreferencesPayload {
  selectedLocationId: string;
  selectedLanguage: LanguageCode;
  favoriteCropIds: string[];
  alertPrefs: WeatherAlertPrefs;
}

export interface CloudUserBundle {
  preferences: CloudPreferencesPayload | null;
  alerts: PriceAlert[];
  notes: FarmNote[];
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128) || `id_${Date.now()}`;
}

function sanitizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_\-]/g, '-').slice(0, 64) || 'bengaluru-rural';
}

export async function loadUserCloudState(uid: string): Promise<CloudUserBundle> {
  const userPath = `users/${uid}`;
  let preferences: CloudPreferencesPayload | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      preferences = {
        selectedLocationId: String(data.selectedLocationId || 'bengaluru-rural'),
        selectedLanguage: (['en', 'kn', 'hi', 'te', 'ta'].includes(data.selectedLanguage)
          ? data.selectedLanguage
          : 'en') as LanguageCode,
        favoriteCropIds: Array.isArray(data.favoriteCropIds)
          ? data.favoriteCropIds.filter((x): x is string => typeof x === 'string').slice(0, 25)
          : [],
        alertPrefs: {
          rain: Boolean(data.alertPrefs?.rain ?? true),
          heavyRain: Boolean(data.alertPrefs?.heavyRain ?? true),
          temperature: Boolean(data.alertPrefs?.temperature ?? false),
          wind: Boolean(data.alertPrefs?.wind ?? true),
          dailyForecast: Boolean(data.alertPrefs?.dailyForecast ?? false),
        },
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const alertsPath = `users/${uid}/alerts`;
  const alerts: PriceAlert[] = [];
  try {
    const alertsSnap = await getDocs(collection(db, 'users', uid, 'alerts'));
    alertsSnap.forEach((d) => {
      const data = d.data();
      alerts.push({
        id: String(data.id || d.id),
        cropId: String(data.cropId || 'tomato'),
        targetPrice: Number(data.targetPrice || 25),
        condition: data.condition === 'below' ? 'below' : 'above',
        channel:
          data.channel === 'sms_demo' || data.channel === 'whatsapp_demo' ? data.channel : 'app',
        enabled: Boolean(data.enabled),
        createdAt: toIsoString(data.createdAt),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, alertsPath);
  }

  const notesPath = `users/${uid}/notes`;
  const notes: FarmNote[] = [];
  try {
    const notesSnap = await getDocs(collection(db, 'users', uid, 'notes'));
    notesSnap.forEach((d) => {
      const data = d.data();
      notes.push({
        id: String(data.id || d.id),
        title: String(data.title || 'Farm Note'),
        content: String(data.content || ''),
        cropId: String(data.cropId || ''),
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, notesPath);
  }

  return {preferences, alerts, notes};
}

export async function saveUserPreferences(
  uid: string,
  prefs: CloudPreferencesPayload,
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  const payload = {
    uid,
    selectedLocationId: sanitizeSlug(prefs.selectedLocationId),
    selectedLanguage: prefs.selectedLanguage,
    favoriteCropIds: prefs.favoriteCropIds.map((c) => sanitizeSlug(c)).slice(0, 25),
    alertPrefs: {
      rain: Boolean(prefs.alertPrefs.rain),
      heavyRain: Boolean(prefs.alertPrefs.heavyRain),
      temperature: Boolean(prefs.alertPrefs.temperature),
      wind: Boolean(prefs.alertPrefs.wind),
      dailyForecast: Boolean(prefs.alertPrefs.dailyForecast),
    },
    updatedAt: serverTimestamp(),
  };

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        selectedLocationId: payload.selectedLocationId,
        selectedLanguage: payload.selectedLanguage,
        favoriteCropIds: payload.favoriteCropIds,
        alertPrefs: payload.alertPrefs,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertCloudAlert(uid: string, alert: PriceAlert): Promise<void> {
  const safeId = sanitizeId(alert.id);
  const path = `users/${uid}/alerts/${safeId}`;
  const ref = doc(db, 'users', uid, 'alerts', safeId);
  const safePrice = Math.min(100000, Math.max(1, Number(alert.targetPrice) || 1));

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        targetPrice: safePrice,
        condition: alert.condition,
        channel: alert.channel,
        enabled: Boolean(alert.enabled),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        ownerUid: uid,
        cropId: sanitizeSlug(alert.cropId),
        targetPrice: safePrice,
        condition: alert.condition,
        channel: alert.channel,
        enabled: Boolean(alert.enabled),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudAlert(uid: string, alertId: string): Promise<void> {
  const safeId = sanitizeId(alertId);
  const path = `users/${uid}/alerts/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'alerts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertCloudNote(uid: string, note: FarmNote): Promise<void> {
  const safeId = sanitizeId(note.id);
  const path = `users/${uid}/notes/${safeId}`;
  const ref = doc(db, 'users', uid, 'notes', safeId);
  const safeTitle = note.title.trim().slice(0, 120) || 'Farm Note';
  const safeContent = note.content.trim().slice(0, 2000) || '-';
  const safeCropId = note.cropId ? sanitizeSlug(note.cropId) : '';

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        title: safeTitle,
        content: safeContent,
        cropId: safeCropId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        ownerUid: uid,
        title: safeTitle,
        content: safeContent,
        cropId: safeCropId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudNote(uid: string, noteId: string): Promise<void> {
  const safeId = sanitizeId(noteId);
  const path = `users/${uid}/notes/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'notes', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
