import {Loader2} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
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
  mergeMarketObservations,
  triggerMarketSync,
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

  // Dynamic AGMARKNET Market feed state
  const [marketFeed, setMarketFeed] = useState<MarketFeedResponse>({
    status: DEFAULT_MARKET_SYNC_STATUS,
    observations: {},
  });
  const [marketSyncing, setMarketSyncing] = useState<boolean>(false);

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

  // Load dynamic market prices from backend AGMARKNET pipeline
  const loadMarketFeed = useCallback(async () => {
    if (!isAuthenticatedAndReady) return;
    try {
      const feed = await fetchDynamicMarketFeed({
        state: store.farmerProfile?.state || store.selectedLocation.state,
        district: store.selectedLocation.district,
        preferredMandi: store.farmerProfile?.preferredMandi,
      });
      setMarketFeed(feed);
    } catch {
      setMarketFeed((prev) => ({
        ...prev,
        status: {
          ...prev.status,
          sourceStatus: 'catalog_reference',
          sourceLabel: 'Reference Catalog (Market server unreachable)',
          isStale: true,
          staleReason: 'Unable to reach /api/market/prices right now.',
        },
      }));
    }
  }, [
    isAuthenticatedAndReady,
    store.farmerProfile?.state,
    store.farmerProfile?.preferredMandi,
    store.selectedLocation.state,
    store.selectedLocation.district,
  ]);

  useEffect(() => {
    void loadMarketFeed();
  }, [loadMarketFeed]);

  const handleRefreshMarket = useCallback(async () => {
    setMarketSyncing(true);
    try {
      const state = store.farmerProfile?.state || store.selectedLocation.state;
      const synced = await triggerMarketSync(state);
      setMarketFeed(synced);
      if (synced.status.sourceStatus === 'live_agmarknet') {
        setToastMessage(
          `Synced ${synced.status.matchedCropCount} live AGMARKNET crop rates.`,
        );
      } else {
        setToastMessage(synced.status.sourceLabel);
      }
    } catch (err: unknown) {
      setToastMessage(getErrorMessage(err, 'Unable to refresh AGMARKNET prices right now.'));
    } finally {
      setMarketSyncing(false);
    }
  }, [store.farmerProfile?.state, store.selectedLocation.state]);

  // Load live weather forecast & crop-sensitive advisories
  const loadWeather = useCallback(
    async (forceRefresh = false) => {
      if (!isAuthenticatedAndReady) return;
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const snapshot = await weatherProvider.getForecast(
          store.selectedLocation,
          store.alertPrefs,
          {
            taluk: store.farmerProfile?.taluk,
            savedCropIds: store.favoriteCropIds,
            forceRefresh,
          },
        );
        setWeather(snapshot);
      } catch (err: unknown) {
        setWeather(null);
        setWeatherError(
          getErrorMessage(err, 'Live weather service is currently unavailable.'),
        );
      } finally {
        setWeatherLoading(false);
      }
    },
    [
      isAuthenticatedAndReady,
      store.selectedLocation,
      store.alertPrefs,
      store.farmerProfile?.taluk,
      store.favoriteCropIds,
    ],
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
        state: store.farmerProfile?.state || store.selectedLocation.state,
        district: store.selectedLocation.district,
        taluk: store.farmerProfile?.taluk,
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
      store.selectedLocation.state,
      store.selectedLocation.district,
      store.farmerProfile?.state,
      store.farmerProfile?.taluk,
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
            onRefreshMarket={() => void handleRefreshMarket()}
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
            onRefreshMarket={() => void handleRefreshMarket()}
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
