import {User} from 'firebase/auth';
import {
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
  X,
} from 'lucide-react';
import React, {useState} from 'react';
import {KARNATAKA_LOCATIONS} from '../data/locations';
import {LANGUAGE_OPTIONS, TranslationPack} from '../data/translations';
import {LanguageCode, LocationOption, NavTab, WeatherAlertPrefs} from '../types/krishi';
import {OfflineIndicator} from './OfflineIndicator';
import {PWAInstallButton} from './PWAInstallButton';

interface AppLayoutProps {
  t: TranslationPack;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedLocation: LocationOption;
  onSelectLocation: (locId: string) => void;
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
  selectedLocation,
  onSelectLocation,
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

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#202820] flex flex-col">
      <OfflineIndicator />

      {/* Top Navigation Header — strict 3-zone desktop, compact mobile */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E4E9E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 lg:h-16 flex items-center justify-between gap-3">
          {/* Zone 1: Brand */}
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 text-left cursor-pointer shrink-0 group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#245C3A] flex items-center justify-center shadow-xs group-hover:bg-[#1d4b2f] transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden="true">
                <circle cx="17" cy="7" r="3" fill="#FBBF24" />
                <path
                  d="M5 18C5 12 9.5 7.5 16 7.5C16 14 11.5 18.5 5 18Z"
                  fill="#EAF3E8"
                />
                <path
                  d="M6 17.5C8.5 15 11.2 12.8 14.5 10.5"
                  stroke="#245C3A"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <span className="font-display font-bold text-base lg:text-lg tracking-tight text-[#202820] block leading-none">
                {t.brandName}
              </span>
              <span className="hidden sm:block text-[11px] text-[#6B756A] mt-0.5 leading-none">
                {selectedLocation.name}, {selectedLocation.state}
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

          {/* Zone 3: Quick Actions + Location/Language/Account Drawer */}
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
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white hover:bg-[#FAF9F4] text-xs sm:text-sm font-medium text-[#202820] cursor-pointer min-h-[40px]"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Farmer profile'}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <MapPin className="w-4 h-4 text-[#245C3A]" />
              )}
              <span className="hidden md:inline max-w-[130px] truncate">
                {user ? user.displayName?.split(' ')[0] || t.settingsAccount : selectedLocation.name}
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
            <span className="font-semibold text-[#202820]">{t.brandName}</span>
            <span>·</span>
            <span>{t.tagline}</span>
          </div>
          <p>{t.demoDisclaimer}</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (5 tabs, >=44px touch targets) */}
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

      {/* Slide-over Location, Language, Account & Preferences Drawer */}
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

            {/* Farmer Account & Cloud Sync */}
            <section className="rounded-2xl border border-[#E4E9E0] bg-[#FAF9F4] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B756A]">
                Cloud Sync & Google Account
              </p>
              {user ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Farmer'}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-[#E4E9E0]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#245C3A] text-white flex items-center justify-center font-bold">
                        {(user.displayName || user.email || 'F')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#202820] truncate">
                        {user.displayName || 'Farmer Account'}
                      </p>
                      <p className="text-xs text-[#6B756A] truncate">{user.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#245C3A] font-medium">
                    {syncing
                      ? 'Syncing crops, alerts, and notes...'
                      : 'Favorites, alerts, and farm notes are synced across devices.'}
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
                      onClick={() => void onSignOut()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-xs font-medium text-[#6B756A] hover:text-red-700 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 space-y-3">
                  <p className="text-xs text-[#6B756A] leading-relaxed">
                    Your crops, alerts, and farm notes save automatically on this device. Sign in
                    with Google anytime to back up and sync across devices.
                  </p>
                  {/* Official Google Sign-In styling */}
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void handleAuthClick(false)}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-[#747775]/40 text-[#1F1F1F] text-sm font-medium shadow-xs hover:bg-[#f8f9fa] transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    <span>{authBusy ? 'Signing in...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              )}
            </section>

            {/* District Selector */}
            <section>
              <label
                htmlFor="drawer-location-select"
                className="block text-xs font-semibold uppercase tracking-wider text-[#6B756A] mb-2"
              >
                District / Weather Area
              </label>
              <select
                id="drawer-location-select"
                value={selectedLocation.id}
                onChange={(e) => onSelectLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E9E0] bg-white text-sm font-medium text-[#202820] focus:outline-none focus:ring-2 focus:ring-[#245C3A]"
              >
                {KARNATAKA_LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}, {loc.state}
                  </option>
                ))}
              </select>
            </section>

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
