import {Loader2} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppLayout} from './components/AppLayout';
import {AuthGateScreen} from './components/AuthGateScreen';
import {GrandOpeningScreen} from './components/GrandOpeningScreen';
import {HomeDashboard} from './components/HomeDashboard';
import {InsightsView} from './components/InsightsView';
import {LocationOnboardingScreen} from './components/LocationOnboardingScreen';
import {MarketPricesView} from './components/MarketPricesView';
import {MyCropsView} from './components/MyCropsView';
import {PriceAlertModal} from './components/PriceAlertModal';
import {Toast} from './components/Toast';
import {WeatherView} from './components/WeatherView';
import {CROP_PRODUCTS} from './data/crops';
import {TRANSLATIONS} from './data/translations';
import {useAudioPlayer} from './hooks/useAudioPlayer';
import {LocationProfilePatch, useKrishiStore} from './hooks/useKrishiStore';
import {
  DEFAULT_MARKET_SYNC_STATUS,
  fetchDynamicMarketFeed,
  fetchSingleCropLivePrice,
  mergeMarketObservations,
  triggerGeminiMarketSync,
} from './services/marketProvider';
import {weatherProvider} from './services/weatherProvider';
import {
  CropProduct,
  MarketFeedResponse,
  NavTab,
  WeatherSnapshot,
} from './types/krishi';

const OFFICIAL_LOGO_URL = '/assets/aistudio/1b0ca66f-3975-4c99-adee-4dfad66df9ff_06020d3d.png';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default function App() {
  const store = useKrishiStore();
  const audio = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedCropId, setSelectedCropId] = useState<string>('tomato');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [alertModalCrop, setAlertModalCrop] = useState<CropProduct | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Weather state (real API only, explicit error if unavailable)
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Dynamic Gemini Google Search Grounding Market feed state
  const [marketFeed, setMarketFeed] = useState<MarketFeedResponse>({
    status: DEFAULT_MARKET_SYNC_STATUS,
    observations: {},
  });
  const [marketSyncing, setMarketSyncing] = useState<boolean>(false);
  const [fetchingCropId, setFetchingCropId] = useState<string | null>(null);

  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  const t = useMemo(
    () => TRANSLATIONS[store.selectedLanguage] || TRANSLATIONS.en,
    [store.selectedLanguage],
  );

  // Merge live/cached AGMARKNET observations with 44-crop Indian catalog
  const products = useMemo(
    () =>
      mergeMarketObservations(
        CROP_PRODUCTS,
        marketFeed.observations,
        marketFeed.status,
      ),
    [marketFeed],
  );

  // Google Maps Case A Quota Exceeded listener
  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const isAuthenticatedAndReady = Boolean(
    store.user &&
      store.user.emailVerified &&
      store.farmerProfile &&
      store.farmerProfile.onboardingCompleted &&
      store.farmerProfile.hasSeenGrandOpening,
  );

  const savedState = store.farmerProfile?.state || store.selectedLocation.state;
  const savedDistrict = store.farmerProfile?.district || store.selectedLocation.district;
  const savedTaluk = store.farmerProfile?.taluk || store.selectedLocation.taluks[0] || '';
  const savedLocationKey = `${store.selectedLocation.id}|${savedState}|${savedDistrict}|${savedTaluk}`;

  // Keep latest saved crops & alert preferences in refs so toggling a favorite or checkbox
  // does not trigger redundant Gemini Search weather requests.
  const favoriteCropIdsRef = useRef<string[]>(store.favoriteCropIds);
  const alertPrefsRef = useRef(store.alertPrefs);
  const selectedLocationRef = useRef(store.selectedLocation);
  const lastWeatherLocationKeyRef = useRef<string>('');

  useEffect(() => {
    favoriteCropIdsRef.current = store.favoriteCropIds;
  }, [store.favoriteCropIds]);

  useEffect(() => {
    alertPrefsRef.current = store.alertPrefs;
  }, [store.alertPrefs]);

  useEffect(() => {
    selectedLocationRef.current = store.selectedLocation;
  }, [store.selectedLocation]);

  // Auto-fetch Gemini-grounded prices for saved crops (and hydrate cached archive)
  const savedCropsKey = store.favoriteCropIds.slice(0, 6).join(',');

  const loadMarketFeed = useCallback(async () => {
    if (!isAuthenticatedAndReady) return;
    const savedIds = savedCropsKey ? savedCropsKey.split(',') : [];
    const shouldAutoFetch = savedIds.length > 0;
    if (shouldAutoFetch) {
      setMarketSyncing(true);
    }
    try {
      const feed = await fetchDynamicMarketFeed({
        state: savedState,
        district: savedDistrict,
        preferredMandi: store.farmerProfile?.preferredMandi,
        cropIds: savedIds,
        autoFetch: shouldAutoFetch,
      });
      setMarketFeed(feed);
    } catch {
      setMarketFeed((prev) => ({
        ...prev,
        status: {
          ...prev.status,
          sourceStatus: 'unavailable',
          sourceLabel: 'Latest verified market price is currently unavailable.',
          isStale: true,
          staleReason: 'Unable to reach /api/market/prices right now.',
        },
      }));
    } finally {
      if (shouldAutoFetch) {
        setMarketSyncing(false);
      }
    }
  }, [
    isAuthenticatedAndReady,
    savedCropsKey,
    savedState,
    savedDistrict,
    store.farmerProfile?.preferredMandi,
  ]);

  useEffect(() => {
    void loadMarketFeed();
  }, [loadMarketFeed]);

  const handleRefreshMarket = useCallback(async () => {
    setMarketSyncing(true);
    try {
      const preferredMandi = store.farmerProfile?.preferredMandi;
      const cropIds =
        store.favoriteCropIds.length > 0
          ? store.favoriteCropIds.slice(0, 6)
          : ['tomato', 'onion', 'potato', 'banana'];

      const synced = await triggerGeminiMarketSync({
        state: savedState,
        district: savedDistrict,
        preferredMandi,
        cropIds,
        forceRefresh: true,
      });
      setMarketFeed(synced);
      const verifiedCount = Object.keys(synced.observations).length;
      if (verifiedCount > 0) {
        setToastMessage(
          `Verified live online prices for ${verifiedCount} ${verifiedCount === 1 ? 'crop' : 'crops'} via Gemini Search.`,
        );
      } else {
        setToastMessage(
          synced.status.staleReason || 'Latest verified market price is currently unavailable.',
        );
      }
    } catch (err: unknown) {
      setToastMessage(
        getErrorMessage(err, 'Unable to fetch live market prices via Gemini Search right now.'),
      );
    } finally {
      setMarketSyncing(false);
    }
  }, [
    savedState,
    savedDistrict,
    store.farmerProfile?.preferredMandi,
    store.favoriteCropIds,
  ]);

  const handleFetchSingleCropPrice = useCallback(
    async (cropId: string, forceRefresh = true) => {
      setFetchingCropId(cropId);
      try {
        const synced = await fetchSingleCropLivePrice({
          cropId,
          state: savedState,
          district: savedDistrict,
          preferredMandi: store.farmerProfile?.preferredMandi,
          forceRefresh,
        });
        setMarketFeed(synced);
        const obs = synced.observations[cropId];
        const crop = CROP_PRODUCTS.find((p) => p.id === cropId);
        const cropName = t.cropNames[cropId] || crop?.name || cropId;
        if (obs) {
          setToastMessage(
            `Verified ${cropName}: ₹${obs.modalPriceKg}/kg at ${obs.market} (${obs.arrivalDate}).`,
          );
        } else {
          setToastMessage(
            `Latest verified market price is currently unavailable for ${cropName}.`,
          );
        }
      } catch (err: unknown) {
        setToastMessage(
          getErrorMessage(err, 'Unable to retrieve live price via Gemini Search right now.'),
        );
      } finally {
        setFetchingCropId(null);
      }
    },
    [
      savedState,
      savedDistrict,
      store.farmerProfile?.preferredMandi,
      t.cropNames,
    ],
  );

  // Load Gemini Search grounded weather ONLY on login, location change, or explicit manual refresh
  const loadWeather = useCallback(
    async (forceRefresh = false) => {
      if (!isAuthenticatedAndReady) return;
      const locChanged = lastWeatherLocationKeyRef.current !== savedLocationKey;
      lastWeatherLocationKeyRef.current = savedLocationKey;

      if (locChanged) {
        const cachedForNewLoc = weatherProvider.getCachedForecast(selectedLocationRef.current, {
          state: savedState,
          district: savedDistrict,
          taluk: savedTaluk,
        });
        setWeather(cachedForNewLoc);
      }

      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const snapshot = await weatherProvider.getForecast(
          selectedLocationRef.current,
          alertPrefsRef.current,
          {
            state: savedState,
            district: savedDistrict,
            taluk: savedTaluk,
            savedCropIds: favoriteCropIdsRef.current,
            forceRefresh,
          },
        );
        setWeather(snapshot);
        if (forceRefresh && snapshot.source === 'live') {
          setToastMessage(`Updated weather for ${snapshot.locationName} (${snapshot.updatedAt}).`);
        } else if (forceRefresh && snapshot.isStale && snapshot.staleReason) {
          setToastMessage(snapshot.staleReason);
        }
      } catch (err: unknown) {
        const msg = getErrorMessage(
          err,
          'Live weather retrieval via Gemini Search is currently unavailable.',
        );
        setWeatherError(msg);
        // Preserve previous verified weather for this same location with explicit stale indicator;
        // never fabricate or wipe verified data on a failed refresh.
        setWeather((prev) => {
          if (!prev || locChanged) return null;
          return {
            ...prev,
            source: 'cached',
            officialProvider: 'cached_gemini_google_search',
            isStale: true,
            staleReason: `${msg} Showing previous verified forecast from ${prev.observationDate || prev.updatedAt}.`,
          };
        });
      } finally {
        setWeatherLoading(false);
      }
    },
    [isAuthenticatedAndReady, savedLocationKey, savedState, savedDistrict, savedTaluk],
  );

  useEffect(() => {
    void loadWeather(false);
  }, [loadWeather]);

  // Surface audio errors via toast
  useEffect(() => {
    if (audio.error && audio.activeKey !== 'daily-briefing') {
      setToastMessage(audio.error);
      audio.clearError();
    }
  }, [audio]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const handleOpenCropDetail = useCallback((cropId: string) => {
    setSelectedCropId(cropId);
    setActiveTab('markets');
    window.scrollTo({top: 0, behavior: 'smooth'});
  }, []);

  const handleToggleFavorite = useCallback(
    (cropId: string) => {
      const added = store.toggleFavorite(cropId);
      const crop = products.find((p) => p.id === cropId);
      const cropName = t.cropNames[cropId] || crop?.name || cropId;
      setToastMessage(
        added ? `Added ${cropName} to My Crops.` : `Removed ${cropName} from My Crops.`,
      );
    },
    [store, products, t],
  );

  const handleWorkspaceSignIn = useCallback(
    async (includeWorkspace = false) => {
      try {
        await store.loginWithGoogle(store.farmerName, includeWorkspace);
        setToastMessage(
          includeWorkspace
            ? 'Connected Google Workspace (Contacts & Chat).'
            : `Signed in as ${store.farmerName}.`,
        );
      } catch (err: unknown) {
        const msg = getErrorMessage(err, 'Unable to connect Google right now.');
        if (msg.includes('popup-closed-by-user')) return;
        setToastMessage(msg);
      }
    },
    [store],
  );

  const handleSignOut = useCallback(async () => {
    audio.stop();
    audio.clearBriefing();
    setWeather(null);
    setWeatherError(null);
    setActiveTab('home');
    await store.logoutGoogle();
    setToastMessage('Signed out safely. Sign in again to access your KRISHI-MITHRA profile.');
  }, [audio, store]);

  const handleUpdateFarmerName = useCallback(
    async (newName: string) => {
      await store.updateFarmerName(newName);
      setToastMessage(`Updated your name to ${newName}.`);
    },
    [store],
  );

  const handleUpdateLocationProfile = useCallback(
    async (patch: LocationProfilePatch) => {
      await store.updateLocationProfile(patch);
      setToastMessage(`Updated farm location to ${patch.district}, ${patch.state}.`);
    },
    [store],
  );

  const handlePlayDailyBriefing = useCallback(
    (forceRefresh = false) => {
      void audio.playDailyBriefing({
        farmerName: store.farmerName,
        locationId: store.selectedLocation.id,
        state: savedState,
        district: savedDistrict,
        taluk: savedTaluk,
        preferredMandi: store.farmerProfile?.preferredMandi,
        savedCropIds: store.favoriteCropIds,
        language: store.selectedLanguage,
        forceRefresh,
      });
    },
    [
      audio,
      store.farmerName,
      store.selectedLocation.id,
      savedState,
      savedDistrict,
      savedTaluk,
      store.farmerProfile?.preferredMandi,
      store.favoriteCropIds,
      store.selectedLanguage,
    ],
  );

  // STEP 0: Branded loading state while Firebase Auth & Firestore profile hydrate
  if (!store.authReady || (store.user && store.profileLoading)) {
    return (
      <div className="min-h-screen bg-[#F7F8F4] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-2xl bg-[#050705] p-2 shadow-lg border border-[#E4E9E0] flex items-center justify-center">
          <img
            src={OFFICIAL_LOGO_URL}
            alt="KRISHI-MITHRA"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#245C3A]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading your KRISHI-MITHRA profile...</span>
        </div>
      </div>
    );
  }

  // STEP 1: Compulsory Auth Gate (Google Sign-In + Compulsory Farmer Name)
  if (!store.user || !store.user.emailVerified) {
    return (
      <>
        <AuthGateScreen
          selectedLanguage={store.selectedLanguage}
          onChangeLanguage={store.setLanguage}
          onGoogleSignIn={async (farmerName) => {
            await store.loginWithGoogle(farmerName, false);
          }}
          externalError={store.cloudError}
        />
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      </>
    );
  }

  // STEP 2: First-Time Location Onboarding (Pan-India State, District, Taluk, Preferred Mandi)
  if (store.farmerProfile && !store.farmerProfile.onboardingCompleted) {
    return (
      <>
        <LocationOnboardingScreen
          farmerName={store.farmerName}
          initialState={store.farmerProfile.state}
          initialLocationId={store.selectedLocationId}
          onComplete={async (patch) => {
            await store.completeLocationOnboarding(patch);
          }}
        />
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      </>
    );
  }

  // STEP 3: First-Time Grand Opening Welcome Screen (Shown once per new account)
  if (store.farmerProfile && !store.farmerProfile.hasSeenGrandOpening) {
    const locationLabel = [
      store.farmerProfile.taluk,
      store.selectedLocation.district,
      store.farmerProfile.state || store.selectedLocation.state,
    ]
      .filter(Boolean)
      .join(', ');
    const preferredMandi =
      store.farmerProfile.preferredMandi ||
      store.selectedLocation.mandis[0] ||
      `${store.selectedLocation.district} APMC`;

    return (
      <>
        <GrandOpeningScreen
          farmerName={store.farmerName}
          locationLabel={locationLabel}
          preferredMandi={preferredMandi}
          language={store.selectedLanguage}
          onEnterDashboard={async () => {
            await store.markGrandOpeningSeen();
          }}
        />
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      </>
    );
  }

  // STEP 4: Main Personalized KRISHI-MITHRA Application
  const isDailyBriefingActive = audio.activeKey === 'daily-briefing';
  const isDailyBriefingLoading = audio.loadingKey === 'daily-briefing';

  return (
    <>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <AppLayout
        t={t}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({top: 0, behavior: 'smooth'});
        }}
        farmerName={store.farmerName}
        farmerProfile={store.farmerProfile}
        selectedLocation={store.selectedLocation}
        onUpdateFarmerName={handleUpdateFarmerName}
        onUpdateLocationProfile={handleUpdateLocationProfile}
        selectedLanguage={store.selectedLanguage}
        onSelectLanguage={(lang) => {
          store.setLanguage(lang);
        }}
        user={store.user}
        syncing={store.syncing}
        onSignIn={handleWorkspaceSignIn}
        onSignOut={handleSignOut}
        alertPrefs={store.alertPrefs}
        onUpdateAlertPrefs={store.updateAlertPrefs}
        globalSearch={searchQuery}
        onGlobalSearchChange={setSearchQuery}
        onGlobalSearchSubmit={() => setActiveTab('markets')}
      >
        {activeTab === 'home' && (
          <HomeDashboard
            t={t}
            language={store.selectedLanguage}
            farmerName={store.farmerName}
            farmerProfile={store.farmerProfile}
            isReturningUserSession={store.isReturningUserSession}
            onDismissReturningWelcome={store.dismissReturningWelcome}
            location={store.selectedLocation}
            products={products}
            marketStatus={marketFeed.status}
            marketSyncing={marketSyncing}
            fetchingCropId={fetchingCropId}
            onRefreshMarket={() => void handleRefreshMarket()}
            onFetchCropPrice={(cropId) => void handleFetchSingleCropPrice(cropId, true)}
            weather={weather}
            weatherLoading={weatherLoading}
            weatherError={weatherError}
            onRetryWeather={() => void loadWeather(true)}
            favoriteCropIds={store.favoriteCropIds}
            priceAlerts={store.priceAlerts}
            onNavigate={setActiveTab}
            onOpenCropDetail={handleOpenCropDetail}
            briefingStatus={isDailyBriefingActive ? audio.status : 'idle'}
            briefingLoading={isDailyBriefingLoading}
            briefingData={audio.briefing}
            briefingError={audio.error}
            onPlayDailyBriefing={handlePlayDailyBriefing}
            onPauseAudio={audio.pause}
            onResumeAudio={audio.resume}
            onStopAudio={audio.stop}
            onDismissBriefing={() => {
              audio.stop();
              audio.clearBriefing();
              audio.clearError();
            }}
          />
        )}

        {activeTab === 'markets' && (
          <MarketPricesView
            t={t}
            language={store.selectedLanguage}
            location={store.selectedLocation}
            products={products}
            marketStatus={marketFeed.status}
            marketSyncing={marketSyncing}
            fetchingCropId={fetchingCropId}
            onRefreshMarket={() => void handleRefreshMarket()}
            onFetchCropPrice={(cropId) => void handleFetchSingleCropPrice(cropId, true)}
            selectedCropId={selectedCropId}
            onSelectCrop={setSelectedCropId}
            favoriteCropIds={store.favoriteCropIds}
            priceAlerts={store.priceAlerts}
            onToggleFavorite={handleToggleFavorite}
            onOpenAlertModal={setAlertModalCrop}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onNotify={setToastMessage}
            audioActiveKey={audio.activeKey}
            audioLoadingKey={audio.loadingKey}
            onListen={(params) => void audio.speakText(params)}
          />
        )}

        {activeTab === 'weather' && (
          <WeatherView
            t={t}
            language={store.selectedLanguage}
            farmerName={store.farmerName}
            location={store.selectedLocation}
            weather={weather}
            loading={weatherLoading}
            weatherError={weatherError}
            onRefresh={() => void loadWeather(true)}
            alertPrefs={store.alertPrefs}
            onUpdateAlertPrefs={store.updateAlertPrefs}
            audioActiveKey={audio.activeKey}
            audioLoadingKey={audio.loadingKey}
            onListen={(params) => void audio.speakText(params)}
          />
        )}

        {activeTab === 'my-crops' && (
          <MyCropsView
            t={t}
            products={products}
            marketStatus={marketFeed.status}
            fetchingCropId={fetchingCropId}
            onFetchCropPrice={(cropId) => void handleFetchSingleCropPrice(cropId, true)}
            favoriteCropIds={store.favoriteCropIds}
            priceAlerts={store.priceAlerts}
            onToggleFavorite={handleToggleFavorite}
            onOpenCropDetail={handleOpenCropDetail}
            onOpenAlertModal={setAlertModalCrop}
            onToggleAlert={store.togglePriceAlert}
            onDeleteAlert={(id) => {
              store.removePriceAlert(id);
              setToastMessage('Price alert removed.');
            }}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'insights' && (
          <InsightsView
            t={t}
            language={store.selectedLanguage}
            farmerName={store.farmerName}
            location={store.selectedLocation}
            preferredMandi={store.farmerProfile?.preferredMandi}
            products={products}
            favoriteCropIds={store.favoriteCropIds}
            weather={weather}
            farmNotes={store.farmNotes}
            workspaceToken={store.workspaceToken}
            onSaveNote={store.saveFarmNote}
            onDeleteNote={(id) => {
              store.removeFarmNote(id);
              setToastMessage('Farm note deleted.');
            }}
            onConnectWorkspace={() => handleWorkspaceSignIn(true)}
            onOpenCropDetail={handleOpenCropDetail}
            onNotify={setToastMessage}
            audioActiveKey={audio.activeKey}
            audioLoadingKey={audio.loadingKey}
            onListen={(params) => void audio.speakText(params)}
          />
        )}
      </AppLayout>

      <PriceAlertModal
        crop={alertModalCrop}
        cropDisplayName={
          alertModalCrop ? t.cropNames[alertModalCrop.id] || alertModalCrop.name : ''
        }
        onClose={() => setAlertModalCrop(null)}
        onSave={(input) => {
          store.addPriceAlert(input);
          const crop = products.find((p) => p.id === input.cropId);
          const cropName = t.cropNames[input.cropId] || crop?.name || input.cropId;
          setToastMessage(`Price alert set for ${cropName} at ₹${input.targetPrice}/kg.`);
        }}
      />

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
