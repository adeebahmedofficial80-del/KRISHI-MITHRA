import {onAuthStateChanged, User} from 'firebase/auth';
import {useCallback, useEffect, useRef, useState} from 'react';
import {findLocationById} from '../data/locations';
import {
  auth,
  deleteCloudAlert,
  deleteCloudNote,
  getOAuthAccessToken,
  loadUserCloudState,
  saveFarmerProfile,
  signInWithGoogle,
  signOutUser,
  splitSavedCropIds,
  testFirestoreConnection,
  upsertCloudAlert,
  upsertCloudNote,
} from '../services/firebase';
import {
  FarmerProfile,
  FarmNote,
  LanguageCode,
  LocationOption,
  PriceAlert,
  WeatherAlertPrefs,
} from '../types/krishi';

const LANG_STORAGE_KEY = 'km_language_v2';

const DEFAULT_ALERT_PREFS: WeatherAlertPrefs = {
  rain: true,
  heavyRain: true,
  temperature: false,
  wind: true,
  dailyForecast: false,
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

export interface LocationProfilePatch {
  state: string;
  district: string;
  taluk: string;
  preferredMandi: string;
  selectedLocationId: string;
}

export function useKrishiStore() {
  const [selectedLanguage, setSelectedLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY) as LanguageCode | null;
      return saved && ['en', 'kn', 'hi', 'te', 'ta'].includes(saved) ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [farmerProfile, setFarmerProfile] = useState<FarmerProfile | null>(null);
  const [isReturningUserSession, setIsReturningUserSession] = useState(false);

  const [selectedLocationId, setSelectedLocationIdState] = useState<string>('bengaluru-rural');
  const [favoriteCropIds, setFavoriteCropIdsState] = useState<string[]>([]);
  const [priceAlerts, setPriceAlertsState] = useState<PriceAlert[]>([]);
  const [farmNotes, setFarmNotesState] = useState<FarmNote[]>([]);
  const [alertPrefs, setAlertPrefsState] = useState<WeatherAlertPrefs>(DEFAULT_ALERT_PREFS);

  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Holds the farmer name entered on the AuthGateScreen before the Google popup completes
  const pendingFarmerNameRef = useRef<string | null>(null);
  const profileRef = useRef<FarmerProfile | null>(null);
  const languageRef = useRef<LanguageCode>(selectedLanguage);

  useEffect(() => {
    profileRef.current = farmerProfile;
  }, [farmerProfile]);

  useEffect(() => {
    languageRef.current = selectedLanguage;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, selectedLanguage);
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedLanguage]);

  // Run Firestore connection check once on mount
  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  const persistProfileSnapshot = useCallback(
    async (nextProfile: FarmerProfile, options?: {updateLastLogin?: boolean}) => {
      if (!auth.currentUser) return;
      try {
        setCloudError(null);
        await saveFarmerProfile(auth.currentUser.uid, nextProfile, options);
      } catch (err: unknown) {
        setCloudError(getErrorMessage(err, 'Unable to save profile changes to cloud.'));
        throw err;
      }
    },
    [],
  );

  // Listen to Firebase Auth state and load/create the user's isolated Firestore profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setWorkspaceToken(getOAuthAccessToken());

      if (!nextUser) {
        // Clear all user-scoped state on sign-out so no account data leaks across users
        setFarmerProfile(null);
        setFavoriteCropIdsState([]);
        setPriceAlertsState([]);
        setFarmNotesState([]);
        setAlertPrefsState(DEFAULT_ALERT_PREFS);
        setSelectedLocationIdState('bengaluru-rural');
        setIsReturningUserSession(false);
        setProfileLoading(false);
        setSyncing(false);
        setAuthReady(true);
        return;
      }

      if (!nextUser.emailVerified) {
        setCloudError('Please sign in with a verified Google email account to access KRISHI-MITHRA.');
        setProfileLoading(false);
        setAuthReady(true);
        return;
      }

      setProfileLoading(true);
      setSyncing(true);
      setCloudError(null);

      try {
        const bundle = await loadUserCloudState(nextUser.uid);
        const enteredName = pendingFarmerNameRef.current?.trim() || '';
        pendingFarmerNameRef.current = null;

        if (bundle.profile && !bundle.isLegacyDoc) {
          // Existing user returning — preserve their saved profile & saved crops
          const effectiveName = enteredName || bundle.profile.farmerName || nextUser.displayName || 'Farmer';
          const updatedProfile: FarmerProfile = {
            ...bundle.profile,
            farmerName: effectiveName,
            email: nextUser.email || bundle.profile.email,
          };

          setFarmerProfile(updatedProfile);
          setSelectedLocationIdState(updatedProfile.selectedLocationId);
          setSelectedLanguageState(updatedProfile.selectedLanguage);
          setFavoriteCropIdsState(updatedProfile.favoriteCropIds);
          setAlertPrefsState(updatedProfile.alertPrefs);
          setPriceAlertsState(bundle.alerts);
          setFarmNotesState(bundle.notes);
          setIsReturningUserSession(updatedProfile.hasSeenGrandOpening);

          await saveFarmerProfile(nextUser.uid, updatedProfile, {updateLastLogin: true});
        } else {
          // Brand-new account OR legacy doc upgrade — start cleanly with 0 crops if brand-new
          const fallbackName = enteredName || bundle.profile?.farmerName || nextUser.displayName || 'Farmer';
          const baseFavs = bundle.profile?.favoriteCropIds ?? [];
          const split = splitSavedCropIds(baseFavs);
          const initialLocationId = bundle.profile?.selectedLocationId || 'bengaluru-rural';

          const newProfile: FarmerProfile = {
            uid: nextUser.uid,
            farmerName: fallbackName.slice(0, 80),
            email: nextUser.email || '',
            state: bundle.profile?.state || '',
            district: bundle.profile?.district || '',
            taluk: bundle.profile?.taluk || '',
            preferredMandi: bundle.profile?.preferredMandi || '',
            selectedLocationId: initialLocationId,
            selectedLanguage: bundle.profile?.selectedLanguage || languageRef.current,
            favoriteCropIds: split.favoriteCropIds,
            savedVegetableIds: split.savedVegetableIds,
            savedFruitIds: split.savedFruitIds,
            alertPrefs: bundle.profile?.alertPrefs || DEFAULT_ALERT_PREFS,
            onboardingCompleted: false,
            hasSeenGrandOpening: false,
          };

          await saveFarmerProfile(nextUser.uid, newProfile, {updateLastLogin: true});

          setFarmerProfile(newProfile);
          setSelectedLocationIdState(newProfile.selectedLocationId);
          setSelectedLanguageState(newProfile.selectedLanguage);
          setFavoriteCropIdsState(newProfile.favoriteCropIds);
          setAlertPrefsState(newProfile.alertPrefs);
          setPriceAlertsState(bundle.alerts);
          setFarmNotesState(bundle.notes);
          setIsReturningUserSession(false);
        }
      } catch (err: unknown) {
        setCloudError(getErrorMessage(err, 'Unable to load your farmer profile from cloud.'));
      } finally {
        setProfileLoading(false);
        setSyncing(false);
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  const updateProfileFields = useCallback(
    async (patch: Partial<FarmerProfile>) => {
      const current = profileRef.current;
      if (!current) return;
      const split = splitSavedCropIds(patch.favoriteCropIds ?? current.favoriteCropIds);
      const next: FarmerProfile = {
        ...current,
        ...patch,
        favoriteCropIds: split.favoriteCropIds,
        savedVegetableIds: split.savedVegetableIds,
        savedFruitIds: split.savedFruitIds,
      };
      setFarmerProfile(next);
      setSelectedLocationIdState(next.selectedLocationId);
      setSelectedLanguageState(next.selectedLanguage);
      setFavoriteCropIdsState(next.favoriteCropIds);
      setAlertPrefsState(next.alertPrefs);
      await persistProfileSnapshot(next);
    },
    [persistProfileSnapshot],
  );

  const completeLocationOnboarding = useCallback(
    async (patch: LocationProfilePatch) => {
      await updateProfileFields({
        ...patch,
        onboardingCompleted: true,
      });
    },
    [updateProfileFields],
  );

  const markGrandOpeningSeen = useCallback(async () => {
    await updateProfileFields({
      hasSeenGrandOpening: true,
    });
  }, [updateProfileFields]);

  const updateFarmerName = useCallback(
    async (name: string) => {
      const cleaned = name.trim().slice(0, 80);
      if (!cleaned) return;
      await updateProfileFields({farmerName: cleaned});
    },
    [updateProfileFields],
  );

  const updateLocationProfile = useCallback(
    async (patch: LocationProfilePatch) => {
      await updateProfileFields({
        ...patch,
        onboardingCompleted: true,
      });
    },
    [updateProfileFields],
  );

  const setLocationId = useCallback(
    (locId: string) => {
      const loc = findLocationById(locId);
      setSelectedLocationIdState(loc.id);
      if (profileRef.current) {
        void updateProfileFields({
          selectedLocationId: loc.id,
          state: loc.state,
          district: loc.district,
          taluk: loc.taluks[0] || '',
          preferredMandi: loc.mandis[0] || '',
        });
      }
    },
    [updateProfileFields],
  );

  const setLanguage = useCallback(
    (lang: LanguageCode) => {
      setSelectedLanguageState(lang);
      if (profileRef.current) {
        void updateProfileFields({selectedLanguage: lang});
      }
    },
    [updateProfileFields],
  );

  const toggleFavorite = useCallback(
    (cropId: string): boolean => {
      const exists = favoriteCropIds.includes(cropId);
      const nextFavs = exists
        ? favoriteCropIds.filter((id) => id !== cropId)
        : [...favoriteCropIds, cropId].slice(0, 80);
      setFavoriteCropIdsState(nextFavs);
      if (profileRef.current) {
        void updateProfileFields({favoriteCropIds: nextFavs});
      }
      return !exists;
    },
    [favoriteCropIds, updateProfileFields],
  );

  const updateAlertPrefs = useCallback(
    (patch: Partial<WeatherAlertPrefs>) => {
      const next = {...alertPrefs, ...patch};
      setAlertPrefsState(next);
      if (profileRef.current) {
        void updateProfileFields({alertPrefs: next});
      }
    },
    [alertPrefs, updateProfileFields],
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
      const target = priceAlerts.find((a) => a.id === alertId);
      if (!target) return;
      const updated: PriceAlert = {...target, enabled: !target.enabled};
      setPriceAlertsState((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      if (auth.currentUser) {
        void upsertCloudAlert(auth.currentUser.uid, updated);
      }
    },
    [priceAlerts],
  );

  const removePriceAlert = useCallback((alertId: string) => {
    setPriceAlertsState((prev) => prev.filter((a) => a.id !== alertId));
    if (auth.currentUser) {
      void deleteCloudAlert(auth.currentUser.uid, alertId);
    }
  }, []);

  const saveFarmNote = useCallback(
    (noteInput: {id?: string; title: string; content: string; cropId: string}) => {
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
    },
    [farmNotes],
  );

  const removeFarmNote = useCallback((noteId: string) => {
    setFarmNotesState((prev) => prev.filter((n) => n.id !== noteId));
    if (auth.currentUser) {
      void deleteCloudNote(auth.currentUser.uid, noteId);
    }
  }, []);

  const loginWithGoogle = useCallback(
    async (farmerName?: string, includeWorkspaceScopes = false) => {
      setCloudError(null);
      const cleanedName = farmerName?.trim() || '';
      if (cleanedName) {
        pendingFarmerNameRef.current = cleanedName;
      }
      try {
        const res = await signInWithGoogle(includeWorkspaceScopes);
        setWorkspaceToken(res.accessToken);
        return res.user;
      } catch (err: unknown) {
        // Never persist a profile if Google auth failed or was cancelled
        pendingFarmerNameRef.current = null;
        throw err;
      }
    },
    [],
  );

  const logoutGoogle = useCallback(async () => {
    pendingFarmerNameRef.current = null;
    await signOutUser();
    setWorkspaceToken(null);
  }, []);

  const selectedLocation: LocationOption = findLocationById(selectedLocationId);
  const farmerName = farmerProfile?.farmerName || user?.displayName || '';

  return {
    selectedLocation,
    selectedLocationId,
    selectedLanguage,
    farmerProfile,
    farmerName,
    favoriteCropIds,
    savedVegetableIds: farmerProfile?.savedVegetableIds ?? [],
    savedFruitIds: farmerProfile?.savedFruitIds ?? [],
    priceAlerts,
    farmNotes,
    alertPrefs,
    user,
    authReady,
    profileLoading,
    isReturningUserSession,
    dismissReturningWelcome: () => setIsReturningUserSession(false),
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
    completeLocationOnboarding,
    markGrandOpeningSeen,
    updateFarmerName,
    updateLocationProfile,
    loginWithGoogle,
    logoutGoogle,
  };
}
