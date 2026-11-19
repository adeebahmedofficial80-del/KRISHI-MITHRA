import {useCallback, useEffect, useMemo, useState} from 'react';
import {AppLayout} from './components/AppLayout';
import {HomeDashboard} from './components/HomeDashboard';
import {InsightsView} from './components/InsightsView';
import {MarketPricesView} from './components/MarketPricesView';
import {MyCropsView} from './components/MyCropsView';
import {PriceAlertModal} from './components/PriceAlertModal';
import {Toast} from './components/Toast';
import {WeatherView} from './components/WeatherView';
import {TRANSLATIONS} from './data/translations';
import {useAudioPlayer} from './hooks/useAudioPlayer';
import {useKrishiStore} from './hooks/useKrishiStore';
import {weatherProvider} from './services/weatherProvider';
import {CropProduct, NavTab, WeatherSnapshot} from './types/krishi';

export default function App() {
  const store = useKrishiStore();
  const audio = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedCropId, setSelectedCropId] = useState<string>('tomato');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [alertModalCrop, setAlertModalCrop] = useState<CropProduct | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  const t = useMemo(
    () => TRANSLATIONS[store.selectedLanguage] || TRANSLATIONS.en,
    [store.selectedLanguage],
  );

  // Google Maps Case A Quota Exceeded listener
  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Load Open-Meteo live weather (with demo fallback)
  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const snapshot = await weatherProvider.getForecast(
        store.selectedLocation,
        store.alertPrefs,
      );
      setWeather(snapshot);
    } finally {
      setWeatherLoading(false);
    }
  }, [store.selectedLocation, store.alertPrefs]);

  useEffect(() => {
    void loadWeather();
  }, [loadWeather]);

  // Surface audio or cloud sync errors via toast
  useEffect(() => {
    if (audio.error) {
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
      const cropName = t.cropNames[cropId] || cropId;
      setToastMessage(added ? `Added ${cropName} to My Crops.` : `Removed ${cropName} from My Crops.`);
    },
    [store, t],
  );

  const handleSignIn = useCallback(
    async (includeWorkspace = false) => {
      try {
        const signedInUser = await store.loginWithGoogle(includeWorkspace);
        setToastMessage(
          `Signed in as ${signedInUser.displayName || signedInUser.email || 'Farmer'}.`,
        );
      } catch (err: any) {
        if (err?.code === 'auth/popup-closed-by-user') return;
        setToastMessage(err?.message || 'Unable to sign in with Google right now.');
      }
    },
    [store],
  );

  const handleSignOut = useCallback(async () => {
    await store.logoutGoogle();
    setToastMessage('Signed out. Local crops and notes remain saved on this device.');
  }, [store]);

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
        selectedLocation={store.selectedLocation}
        onSelectLocation={(locId) => {
          store.setLocationId(locId);
          setToastMessage('Updated farm district and weather forecast.');
        }}
        selectedLanguage={store.selectedLanguage}
        onSelectLanguage={(lang) => {
          store.setLanguage(lang);
        }}
        user={store.user}
        syncing={store.syncing}
        onSignIn={handleSignIn}
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
            location={store.selectedLocation}
            weather={weather}
            weatherLoading={weatherLoading}
            favoriteCropIds={store.favoriteCropIds}
            priceAlerts={store.priceAlerts}
            onNavigate={setActiveTab}
            onOpenCropDetail={handleOpenCropDetail}
            audioActiveKey={audio.activeKey}
            audioLoadingKey={audio.loadingKey}
            onListen={(params) => void audio.speakText(params)}
          />
        )}

        {activeTab === 'markets' && (
          <MarketPricesView
            t={t}
            language={store.selectedLanguage}
            location={store.selectedLocation}
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
            location={store.selectedLocation}
            weather={weather}
            loading={weatherLoading}
            onRefresh={() => void loadWeather()}
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
            location={store.selectedLocation}
            weather={weather}
            farmNotes={store.farmNotes}
            workspaceToken={store.workspaceToken}
            onSaveNote={store.saveFarmNote}
            onDeleteNote={(id) => {
              store.removeFarmNote(id);
              setToastMessage('Farm note deleted.');
            }}
            onConnectWorkspace={() => handleSignIn(true)}
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
          const cropName = t.cropNames[input.cropId] || input.cropId;
          setToastMessage(`Price alert set for ${cropName} at ₹${input.targetPrice}/kg.`);
        }}
      />

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </>
  );
}
