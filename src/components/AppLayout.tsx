import {User} from 'firebase/auth';
import {
  Check,
  CloudSun,
  Home,
  Lightbulb,
  LogOut,
  MapPin,
  Menu,
  Search,
  Settings,
  Sprout,
  Store,
  TrendingUp,
  User as UserIcon,
  X,
} from 'lucide-react';
import React, {useMemo, useState} from 'react';
import {ALL_INDIA_LOCATIONS, getLocationsByState, INDIAN_STATES} from '../data/locations';
import {LANGUAGE_OPTIONS, TranslationPack} from '../data/translations';
import {LocationProfilePatch} from '../hooks/useKrishiStore';
import {
  FarmerProfile,
  LanguageCode,
  LocationOption,
  NavTab,
  WeatherAlertPrefs,
} from '../types/krishi';
import {OfflineIndicator} from './OfflineIndicator';
import {PWAInstallButton} from './PWAInstallButton';

const OFFICIAL_LOGO_URL = '/assets/aistudio/1b0ca66f-3975-4c99-adee-4dfad66df9ff_06020d3d.png';

interface AppLayoutProps {
  t: TranslationPack;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  farmerName: string;
  farmerProfile: FarmerProfile | null;
  selectedLocation: LocationOption;
  onUpdateFarmerName: (name: string) => Promise<void>;
  onUpdateLocationProfile: (patch: LocationProfilePatch) => Promise<void>;
  selectedLanguage: LanguageCode;
  onSelectLanguage: (lang: LanguageCode) => void;
  user: User | null;
  syncing: boolean;
  onSignIn: (includeWorkspace?: boolean) => Promise<void>;
  onSignOut: () => Promise<void>;
  alertPrefs: WeatherAlertPrefs;
  onUpdateAlertPrefs: (patch: Partial<WeatherAlertPrefs>) => void;
  globalSearch: string;
  onGlobalSearchChange: (val: string) => void;
  onGlobalSearchSubmit: () => void;
  children: React.ReactNode;
}

export function AppLayout({
  t,
  activeTab,
  onSelectTab,
  farmerName,
  farmerProfile,
  selectedLocation,
  onUpdateFarmerName,
  onUpdateLocationProfile,
  selectedLanguage,
  onSelectLanguage,
  user,
  syncing,
  onSignIn,
  onSignOut,
  alertPrefs,
  onUpdateAlertPrefs,
  globalSearch,
  onGlobalSearchChange,
  onGlobalSearchSubmit,
  children,
}: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // Inline editable profile fields in drawer
  const [draftName, setDraftName] = useState(farmerName);
  const [draftState, setDraftState] = useState(farmerProfile?.state || selectedLocation.state);
  const [draftLocationId, setDraftLocationId] = useState(selectedLocation.id);
  const [draftTaluk, setDraftTaluk] = useState(
    farmerProfile?.taluk || selectedLocation.taluks[0] || '',
  );
  const [draftMandi, setDraftMandi] = useState(
    farmerProfile?.preferredMandi || selectedLocation.mandis[0] || '',
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const openDrawer = () => {
    setDraftName(farmerName);
    setDraftState(farmerProfile?.state || selectedLocation.state);
    setDraftLocationId(selectedLocation.id);
    setDraftTaluk(farmerProfile?.taluk || selectedLocation.taluks[0] || '');
    setDraftMandi(farmerProfile?.preferredMandi || selectedLocation.mandis[0] || '');
    setDrawerOpen(true);
  };

  const stateDistricts = useMemo(() => getLocationsByState(draftState), [draftState]);
  const activeDraftLoc = useMemo(
    () =>
      stateDistricts.find((l) => l.id === draftLocationId) ||
      stateDistricts[0] ||
      selectedLocation,
    [stateDistricts, draftLocationId, selectedLocation],
  );

  const navItems: {id: NavTab; label: string; icon: React.ComponentType<{className?: string}>}[] = [
    {id: 'home', label: t.navHome, icon: Home},
    {id: 'markets', label: t.navMarkets, icon: Store},
    {id: 'weather', label: t.navWeather, icon: CloudSun},
    {id: 'my-crops', label: t.navMyCrops, icon: Sprout},
    {id: 'insights', label: t.navInsights, icon: Lightbulb},
  ];

  const handleAuthClick = async (includeWorkspace = false) => {
    setAuthBusy(true);
    try {
      await onSignIn(includeWorkspace);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveProfileEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      if (draftName.trim() && draftName.trim() !== farmerName) {
        await onUpdateFarmerName(draftName.trim());
      }
      await onUpdateLocationProfile({
        state: activeDraftLoc.state,
        district: activeDraftLoc.district,
        taluk: draftTaluk || activeDraftLoc.taluks[0] || '',
        preferredMandi: draftMandi || activeDraftLoc.mandis[0] || '',
        selectedLocationId: activeDraftLoc.id,
      });
      setDrawerOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const displayLocality = farmerProfile?.taluk
    ? `${farmerProfile.taluk}, ${selectedLocation.district}`
    : `${selectedLocation.district}, ${selectedLocation.state}`;

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#202820] flex flex-col">
      <OfflineIndicator />

      {/* Top Navigation Header — 3-zone desktop, compact mobile */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E4E9E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 lg:h-16 flex items-center justify-between gap-3">
          {/* Zone 1: Official KRISHI-MITHRA Brand */}
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 text-left cursor-pointer shrink-0 group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#050705] border border-[#245C3A]/40 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="KRISHI-MITHRA"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div>
              <span className="font-display font-bold text-base lg:text-lg tracking-tight text-[#202820] block leading-none">
                KRISHI-MITHRA
              </span>
              <span className="hidden sm:block text-[11px] text-[#6B756A] mt-0.5 leading-none truncate max-w-[190px]">
                {displayLocality}
              </span>
            </div>
          </button>

          {/* Zone 2: Desktop 5-tab Primary Nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#EAF3E8] text-[#245C3A] font-semibold'
                      : 'text-[#6B756A] hover:text-[#202820] hover:bg-[#FAF9F4]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quick Actions + Profile/Location/Language Drawer */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t.searchPlaceholder}
              className="p-2.5 rounded-xl border border-[#E4E9E0] bg-white text-[#202820] hover:bg-[#FAF9F4] cursor-pointer"
              title={t.searchPlaceholder}
            >
              <Search className="w-4 h-4" />
            </button>

            <PWAInstallButton />

            <button
              type="button"
              onClick={openDrawer}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white hover:bg-[#FAF9F4] text-xs sm:text-sm font-medium text-[#202820] cursor-pointer min-h-[40px]"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={farmerName || 'Farmer profile'}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <MapPin className="w-4 h-4 text-[#245C3A]" />
              )}
              <span className="hidden md:inline max-w-[130px] truncate">
                {farmerName || selectedLocation.name}
              </span>
              <span className="text-[11px] font-mono uppercase text-[#6B756A] border-l border-[#E4E9E0] pl-2">
                {selectedLanguage}
              </span>
              <Menu className="w-3.5 h-3.5 text-[#6B756A] md:hidden" />
            </button>
          </div>
        </div>

        {/* Expandable Quick Search Bar */}
        {searchOpen && (
          <div className="border-t border-[#E4E9E0] bg-[#FAF9F4] px-4 py-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onGlobalSearchSubmit();
                setSearchOpen(false);
              }}
              className="max-w-3xl mx-auto flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#6B756A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={globalSearch}
                  onChange={(e) => onGlobalSearchChange(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820] focus:outline-none focus:ring-2 focus:ring-[#245C3A]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#245C3A] text-white text-sm font-semibold cursor-pointer hover:bg-[#1d4b2f]"
              >
                Go
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2 rounded-xl text-[#6B756A] hover:bg-white cursor-pointer"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-24 lg:pb-12">
        {children}
      </main>

      {/* Desktop Footer */}
      <footer className="hidden lg:block border-t border-[#E4E9E0] bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#6B756A]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#245C3A]" />
            <span className="font-semibold text-[#202820]">KRISHI-MITHRA</span>
            <span>·</span>
            <span>{t.tagline}</span>
          </div>
          <p>
            Market prices depend on grade, variety, and daily APMC auction arrivals. Always verify
            mandi receipts and transport costs before dispatch.
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E4E9E0] pb-[env(safe-area-inset-bottom)]"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-h-[48px] px-1 cursor-pointer transition-colors ${
                  active ? 'text-[#245C3A]' : 'text-[#6B756A]'
                }`}
              >
                <div
                  className={`px-3 py-1 rounded-full ${
                    active ? 'bg-[#EAF3E8]' : 'bg-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-medium truncate max-w-full leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Slide-over Farmer Profile, Location, Language & Alert Preferences Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={t.settingsAccount}
        >
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 shadow-2xl border-l border-[#E4E9E0] flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-[#E4E9E0] pb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#245C3A]" />
                <h2 className="text-lg font-bold text-[#202820]">{t.settingsAccount}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close drawer"
                className="p-2 rounded-xl text-[#6B756A] hover:bg-[#FAF9F4] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Signed-in Farmer Account Summary */}
            {user && (
              <section className="rounded-2xl border border-[#E4E9E0] bg-[#FAF9F4] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={farmerName || 'Farmer'}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-[#E4E9E0]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#245C3A] text-white flex items-center justify-center font-bold">
                      {(farmerName || user.email || 'F')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#202820] truncate">
                      {farmerName || user.displayName}
                    </p>
                    <p className="text-xs text-[#6B756A] truncate">{user.email}</p>
                  </div>
                </div>
                <p className="text-xs text-[#245C3A] font-medium">
                  {syncing
                    ? 'Syncing profile, crops, alerts, and notes...'
                    : 'Profile, tracked crops, alerts, and notes are synced securely.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void handleAuthClick(true)}
                    className="px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-xs font-medium text-[#202820] hover:bg-[#EAF3E8] cursor-pointer"
                  >
                    Grant Contacts / Chat Access
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      void onSignOut();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-xs font-medium text-[#6B756A] hover:text-red-700 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </section>
            )}

            {/* Edit Farmer Name & Location Profile */}
            <form onSubmit={handleSaveProfileEdits} className="space-y-3.5">
              <div>
                <label
                  htmlFor="drawer-farmer-name"
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-1.5"
                >
                  <UserIcon className="w-3.5 h-3.5 text-[#245C3A]" />
                  <span>Farmer Name</span>
                </label>
                <input
                  id="drawer-farmer-name"
                  type="text"
                  required
                  maxLength={80}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm font-medium text-[#202820] focus:outline-none focus:ring-2 focus:ring-[#245C3A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="drawer-state"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-1"
                  >
                    State
                  </label>
                  <select
                    id="drawer-state"
                    value={draftState}
                    onChange={(e) => {
                      const nextSt = e.target.value;
                      setDraftState(nextSt);
                      const first = getLocationsByState(nextSt)[0];
                      if (first) {
                        setDraftLocationId(first.id);
                        setDraftTaluk(first.taluks[0] || '');
                        setDraftMandi(first.mandis[0] || '');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820]"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="drawer-district"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-1"
                  >
                    District
                  </label>
                  <select
                    id="drawer-district"
                    value={activeDraftLoc.id}
                    onChange={(e) => {
                      const found = ALL_INDIA_LOCATIONS.find((l) => l.id === e.target.value);
                      if (found) {
                        setDraftLocationId(found.id);
                        setDraftTaluk(found.taluks[0] || '');
                        setDraftMandi(found.mandis[0] || '');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820]"
                  >
                    {stateDistricts.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.district}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="drawer-taluk"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-1"
                  >
                    Taluk / Locality
                  </label>
                  <select
                    id="drawer-taluk"
                    value={draftTaluk}
                    onChange={(e) => setDraftTaluk(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820]"
                  >
                    {activeDraftLoc.taluks.map((tk) => (
                      <option key={tk} value={tk}>
                        {tk}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="drawer-mandi"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-1"
                  >
                    Preferred Mandi
                  </label>
                  <select
                    id="drawer-mandi"
                    value={draftMandi}
                    onChange={(e) => setDraftMandi(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820]"
                  >
                    {activeDraftLoc.mandis.map((md) => (
                      <option key={md} value={md}>
                        {md}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C3A] hover:bg-[#1D4B2F] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{savingProfile ? 'Saving profile...' : 'Save Name & Location'}</span>
              </button>
            </form>

            {/* 5-Language Selector */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-2">
                App Language
              </p>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const active = selectedLanguage === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => onSelectLanguage(opt.code)}
                      className={`px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#EAF3E8] border-[#245C3A] text-[#245C3A]'
                          : 'bg-white border-[#E4E9E0] text-[#202820] hover:bg-[#FAF9F4]'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{opt.nativeLabel}</span>
                      <span className="block text-[11px] text-[#6B756A]">{opt.englishLabel}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Weather Alert Toggles */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-2">
                {t.alertPreferencesTitle}
              </p>
              <div className="space-y-2">
                {[
                  {key: 'rain' as const, label: 'Rain & shower alerts'},
                  {key: 'heavyRain' as const, label: 'Heavy rainfall warnings'},
                  {key: 'temperature' as const, label: 'High afternoon heat alerts'},
                  {key: 'wind' as const, label: 'Spraying wind alerts'},
                  {key: 'dailyForecast' as const, label: 'Daily morning summary reminder'},
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[#E4E9E0] bg-white cursor-pointer"
                  >
                    <span className="text-sm text-[#202820]">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={alertPrefs[item.key]}
                      onChange={(e) => onUpdateAlertPrefs({[item.key]: e.target.checked})}
                      className="w-4 h-4 accent-[#245C3A]"
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
