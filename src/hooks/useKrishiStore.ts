import {onAuthStateChanged, User} from 'firebase/auth';
import {useCallback, useEffect, useRef, useState} from 'react';
import {KARNATAKA_LOCATIONS} from '../data/locations';
import {
  auth,
  deleteCloudAlert,
  deleteCloudNote,
  getOAuthAccessToken,
  loadUserCloudState,
  saveUserPreferences,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
  upsertCloudAlert,
  upsertCloudNote,
} from '../services/firebase';
import {
  FarmNote,
  LanguageCode,
  LocationOption,
  PriceAlert,
  WeatherAlertPrefs,
} from '../types/krishi';

const STORAGE_KEYS = {
  location: 'km_location_v1',
  language: 'km_language_v1',
  favorites: 'km_favorites_v1',
  alerts: 'km_price_alerts_v1',
  notes: 'km_farm_notes_v1',
  alertPrefs: 'km_weather_prefs_v1',
};

const DEFAULT_FAVORITES = ['tomato', 'onion', 'banana'];

const DEFAULT_ALERT_PREFS: WeatherAlertPrefs = {
  rain: true,
  heavyRain: true,
  temperature: false,
  wind: true,
  dailyForecast: false,
};

const DEFAULT_ALERTS: PriceAlert[] = [
  {
    id: 'alert_default_tomato',
    cropId: 'tomato',
    targetPrice: 25,
    condition: 'above',
    channel: 'app',
    enabled: true,
    createdAt: '2026-11-18T06:30:00.000Z',
  },
];

const DEFAULT_NOTES: FarmNote[] = [
  {
    id: 'note_default_1',
    title: 'Tomato crate grading check',
    content:
      'Sort pink-stage tomatoes separately from full red before loading crates for Bengaluru APMC.',
    cropId: 'tomato',
    createdAt: '2026-11-18T06:00:00.000Z',
    updatedAt: '2026-11-18T06:00:00.000Z',
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useKrishiStore() {
  const [selectedLocationId, setSelectedLocationIdState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.location);
    return saved && KARNATAKA_LOCATIONS.some((l) => l.id === saved) ? saved : 'bengaluru-rural';
  });

  const [selectedLanguage, setSelectedLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.language) as LanguageCode | null;
    return saved && ['en', 'kn', 'hi', 'te', 'ta'].includes(saved) ? saved : 'en';
  });

  const [favoriteCropIds, setFavoriteCropIdsState] = useState<string[]>(() =>
    readJson<string[]>(STORAGE_KEYS.favorites, DEFAULT_FAVORITES),
  );

  const [priceAlerts, setPriceAlertsState] = useState<PriceAlert[]>(() =>
    readJson<PriceAlert[]>(STORAGE_KEYS.alerts, DEFAULT_ALERTS),
  );

  const [farmNotes, setFarmNotesState] = useState<FarmNote[]>(() =>
    readJson<FarmNote[]>(STORAGE_KEYS.notes, DEFAULT_NOTES),
  );

  const [alertPrefs, setAlertPrefsState] = useState<WeatherAlertPrefs>(() =>
    readJson<WeatherAlertPrefs>(STORAGE_KEYS.alertPrefs, DEFAULT_ALERT_PREFS),
  );

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const syncingFromCloudRef = useRef(false);

  // Run Firestore connection validation once on mount
  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  // Persist local state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.location, selectedLocationId);
  }, [selectedLocationId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.language, selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favoriteCropIds));
  }, [favoriteCropIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(priceAlerts));
  }, [priceAlerts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(farmNotes));
  }, [farmNotes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.alertPrefs, JSON.stringify(alertPrefs));
  }, [alertPrefs]);

  // Listen to Firebase Auth state and sync cloud state if signed in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setWorkspaceToken(getOAuthAccessToken());

      if (!nextUser) {
        return;
      }

      setSyncing(true);
      setCloudError(null);
      syncingFromCloudRef.current = true;
      try {
        const bundle = await loadUserCloudState(nextUser.uid);
        if (bundle.preferences) {
          setSelectedLocationIdState(bundle.preferences.selectedLocationId);
          setSelectedLanguageState(bundle.preferences.selectedLanguage);
          setFavoriteCropIdsState(bundle.preferences.favoriteCropIds);
          setAlertPrefsState(bundle.preferences.alertPrefs);
        } else {
          // Seed cloud preferences from local first-run state
          await saveUserPreferences(nextUser.uid, {
            selectedLocationId,
            selectedLanguage,
            favoriteCropIds,
            alertPrefs,
          });
        }

        if (bundle.alerts.length > 0) {
          setPriceAlertsState(bundle.alerts);
        } else if (priceAlerts.length > 0) {
          await Promise.all(priceAlerts.map((a) => upsertCloudAlert(nextUser.uid, a)));
        }

        if (bundle.notes.length > 0) {
          setFarmNotesState(bundle.notes);
        } else if (farmNotes.length > 0) {
          await Promise.all(farmNotes.map((n) => upsertCloudNote(nextUser.uid, n)));
        }
      } catch (err: any) {
        setCloudError(err?.message || 'Unable to sync with cloud right now.');
      } finally {
        syncingFromCloudRef.current = false;
        setSyncing(false);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncPrefsIfSignedIn = useCallback(
    async (next: {
      selectedLocationId: string;
      selectedLanguage: LanguageCode;
      favoriteCropIds: string[];
      alertPrefs: WeatherAlertPrefs;
    }) => {
      if (!auth.currentUser || syncingFromCloudRef.current) return;
      try {
        await saveUserPreferences(auth.currentUser.uid, next);
      } catch (err: any) {
        setCloudError(err?.message || 'Cloud sync warning.');
      }
    },
    [],
  );

  const setLocationId = useCallback(
    (locId: string) => {
      setSelectedLocationIdState(locId);
      void syncPrefsIfSignedIn({
        selectedLocationId: locId,
        selectedLanguage,
        favoriteCropIds,
        alertPrefs,
      });
    },
    [selectedLanguage, favoriteCropIds, alertPrefs, syncPrefsIfSignedIn],
  );

  const setLanguage = useCallback(
    (lang: LanguageCode) => {
      setSelectedLanguageState(lang);
      void syncPrefsIfSignedIn({
        selectedLocationId,
        selectedLanguage: lang,
        favoriteCropIds,
        alertPrefs,
      });
    },
    [selectedLocationId, favoriteCropIds, alertPrefs, syncPrefsIfSignedIn],
  );

  const toggleFavorite = useCallback(
    (cropId: string): boolean => {
      let added = false;
      const exists = favoriteCropIds.includes(cropId);
      const nextFavs = exists
        ? favoriteCropIds.filter((id) => id !== cropId)
        : [...favoriteCropIds, cropId].slice(0, 25);
      added = !exists;
      setFavoriteCropIdsState(nextFavs);
      void syncPrefsIfSignedIn({
        selectedLocationId,
        selectedLanguage,
        favoriteCropIds: nextFavs,
        alertPrefs,
      });
      return added;
    },
    [favoriteCropIds, selectedLocationId, selectedLanguage, alertPrefs, syncPrefsIfSignedIn],
  );

  const updateAlertPrefs = useCallback(
    (patch: Partial<WeatherAlertPrefs>) => {
      const next = {...alertPrefs, ...patch};
      setAlertPrefsState(next);
      void syncPrefsIfSignedIn({
        selectedLocationId,
        selectedLanguage,
        favoriteCropIds,
        alertPrefs: next,
      });
    },
    [alertPrefs, selectedLocationId, selectedLanguage, favoriteCropIds, syncPrefsIfSignedIn],
  );

  const addPriceAlert = useCallback(
    (input: {
      cropId: string;
      targetPrice: number;
      condition: 'above' | 'below';
      channel: 'app' | 'sms_demo' | 'whatsapp_demo';
    }) => {
      const newAlert: PriceAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        cropId: input.cropId,
        targetPrice: Math.max(1, Math.round(input.targetPrice)),
        condition: input.condition,
        channel: input.channel,
        enabled: true,
        createdAt: new Date().toISOString(),
      };
      setPriceAlertsState((prev) => [newAlert, ...prev]);
      if (auth.currentUser) {
        void upsertCloudAlert(auth.currentUser.uid, newAlert);
      }
      return newAlert;
    },
    [],
  );

  const togglePriceAlert = useCallback(
    (alertId: string) => {
      let updated: PriceAlert | undefined;
      setPriceAlertsState((prev) =>
        prev.map((a) => {
          if (a.id !== alertId) return a;
          updated = {...a, enabled: !a.enabled};
          return updated;
        }),
      );
      if (updated && auth.currentUser) {
        void upsertCloudAlert(auth.currentUser.uid, updated);
      }
    },
    [],
  );

  const removePriceAlert = useCallback((alertId: string) => {
    setPriceAlertsState((prev) => prev.filter((a) => a.id !== alertId));
    if (auth.currentUser) {
      void deleteCloudAlert(auth.currentUser.uid, alertId);
    }
  }, []);

  const saveFarmNote = useCallback((noteInput: {id?: string; title: string; content: string; cropId: string}) => {
    const now = new Date().toISOString();
    const existing = noteInput.id ? farmNotes.find((n) => n.id === noteInput.id) : undefined;
    const saved: FarmNote = existing
      ? {
          ...existing,
          title: noteInput.title.trim().slice(0, 120),
          content: noteInput.content.trim().slice(0, 2000),
          cropId: noteInput.cropId,
          updatedAt: now,
        }
      : {
          id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: noteInput.title.trim().slice(0, 120),
          content: noteInput.content.trim().slice(0, 2000),
          cropId: noteInput.cropId,
          createdAt: now,
          updatedAt: now,
        };

    setFarmNotesState((prev) =>
      existing ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev],
    );
    if (auth.currentUser) {
      void upsertCloudNote(auth.currentUser.uid, saved);
    }
    return saved;
  }, [farmNotes]);

  const removeFarmNote = useCallback((noteId: string) => {
    setFarmNotesState((prev) => prev.filter((n) => n.id !== noteId));
    if (auth.currentUser) {
      void deleteCloudNote(auth.currentUser.uid, noteId);
    }
  }, []);

  const loginWithGoogle = useCallback(async (includeWorkspaceScopes = false) => {
    setCloudError(null);
    const res = await signInWithGoogle(includeWorkspaceScopes);
    setWorkspaceToken(res.accessToken);
    return res.user;
  }, []);

  const logoutGoogle = useCallback(async () => {
    await signOutUser();
    setWorkspaceToken(null);
  }, []);

  const selectedLocation: LocationOption =
    KARNATAKA_LOCATIONS.find((l) => l.id === selectedLocationId) || KARNATAKA_LOCATIONS[0];

  return {
    selectedLocation,
    selectedLocationId,
    selectedLanguage,
    favoriteCropIds,
    priceAlerts,
    farmNotes,
    alertPrefs,
    user,
    authReady,
    workspaceToken,
    syncing,
    cloudError,
    setLocationId,
    setLanguage,
    toggleFavorite,
    updateAlertPrefs,
    addPriceAlert,
    togglePriceAlert,
    removePriceAlert,
    saveFarmNote,
    removeFarmNote,
    loginWithGoogle,
    logoutGoogle,
  };
}
