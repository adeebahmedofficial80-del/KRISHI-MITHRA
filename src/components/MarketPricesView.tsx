import {
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Info,
  Search,
  Sprout,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {KARNATAKA_MARKETS} from '../data/locations';
import {TranslationPack} from '../data/translations';
import {marketProvider} from '../services/marketProvider';
import {CropProduct, LanguageCode, LocationOption, PriceAlert} from '../types/krishi';
import {CropImage} from './CropImage';
import {ProductDetailPanel} from './ProductDetailPanel';

interface MarketPricesViewProps {
  t: TranslationPack;
  language: LanguageCode;
  location: LocationOption;
  selectedCropId: string;
  onSelectCrop: (cropId: string) => void;
  favoriteCropIds: string[];
  priceAlerts: PriceAlert[];
  onToggleFavorite: (cropId: string) => void;
  onOpenAlertModal: (crop: CropProduct) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onNotify: (msg: string) => void;
  audioActiveKey: string | null;
  audioLoadingKey: string | null;
  onListen: (params: {
    key: string;
    text: string;
    language: LanguageCode;
    quickSummarizeTopic?: string;
    quickSummarizePayload?: Record<string, unknown>;
  }) => void;
}

type CategoryTab = 'all' | 'vegetable' | 'fruit' | 'favorites';
type SortMode = 'modal_desc' | 'modal_asc' | 'change_desc' | 'name_asc';

export function MarketPricesView({
  t,
  language,
  location,
  selectedCropId,
  onSelectCrop,
  favoriteCropIds,
  priceAlerts,
  onToggleFavorite,
  onOpenAlertModal,
  searchQuery,
  onSearchQueryChange,
  onNotify,
  audioActiveKey,
  audioLoadingKey,
  onListen,
}: MarketPricesViewProps) {
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('modal_desc');

  const allVegetables = useMemo(() => marketProvider.getProductsByCategory('vegetable'), []);
  const allFruits = useMemo(() => marketProvider.getProductsByCategory('fruit'), []);
  const allProducts = useMemo(() => marketProvider.getAllProducts(), []);

  const selectedCrop = useMemo(
    () => marketProvider.getProductById(selectedCropId) || allProducts[0],
    [selectedCropId, allProducts],
  );

  const filterAndSort = (list: CropProduct[]) => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = list.filter((crop) => {
      const localName = (t.cropNames[crop.id] || '').toLowerCase();
      const matchesQuery =
        !q ||
        crop.name.toLowerCase().includes(q) ||
        localName.includes(q) ||
        crop.variety.toLowerCase().includes(q) ||
        crop.market.toLowerCase().includes(q);
      const matchesFav =
        categoryTab !== 'favorites' || favoriteCropIds.includes(crop.id);
      const matchesMarket =
        marketFilter === 'all' ||
        crop.marketComparisons.some((m) => m.marketId === marketFilter);
      return matchesQuery && matchesFav && matchesMarket;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'modal_desc') return b.modalPrice - a.modalPrice;
      if (sortMode === 'modal_asc') return a.modalPrice - b.modalPrice;
      if (sortMode === 'change_desc') return b.priceChangePercent - a.priceChangePercent;
      const nameA = t.cropNames[a.id] || a.name;
      const nameB = t.cropNames[b.id] || b.name;
      return nameA.localeCompare(nameB);
    });
  };

  const visibleVegetables = useMemo(
    () => (categoryTab === 'fruit' ? [] : filterAndSort(allVegetables)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allVegetables, searchQuery, categoryTab, marketFilter, sortMode, favoriteCropIds, t],
  );

  const visibleFruits = useMemo(
    () => (categoryTab === 'vegetable' ? [] : filterAndSort(allFruits)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allFruits, searchQuery, categoryTab, marketFilter, sortMode, favoriteCropIds, t],
  );

  const combinedVisible = [...visibleVegetables, ...visibleFruits];

  const handleSelectAndScroll = (cropId: string) => {
    onSelectCrop(cropId);
    const el = document.getElementById('crop-detail-panel-anchor');
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  };

  const renderCategoryTabsAndGrid = (
    title: string,
    subtitle: string,
    fullTenList: CropProduct[],
    filteredList: CropProduct[],
  ) => (
    <section className="space-y-4 bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#E4E9E0] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#202820]">{title}</h2>
            <span className="font-mono text-xs font-semibold text-[#245C3A] bg-[#EAF3E8] px-2.5 py-0.5 rounded-md tabular-nums">
              {fullTenList.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B756A] mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs text-[#6B756A]">Select a product tab below to inspect details</span>
      </div>

      {/* 10 Interactive Product Tabs */}
      <div
        className="grid grid-cols-2 sm:grid-cols-5 gap-2"
        role="tablist"
        aria-label={`${title} product tabs`}
      >
        {fullTenList.map((crop) => {
          const active = selectedCrop.id === crop.id;
          const displayName = t.cropNames[crop.id] || crop.name;
          return (
            <button
              key={crop.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectCrop(crop.id)}
              className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer min-h-[52px] ${
                active
                  ? 'bg-[#EAF3E8] border-[#245C3A] ring-1 ring-[#245C3A] shadow-xs'
                  : 'bg-[#FAF9F4] border-[#E4E9E0] hover:border-[#245C3A]/50 hover:bg-white'
              }`}
            >
              <CropImage
                src={crop.image}
                alt={displayName}
                className="w-9 h-9 rounded-lg border border-[#E4E9E0] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span
                  className={`block text-xs font-semibold truncate ${
                    active ? 'text-[#245C3A]' : 'text-[#202820]'
                  }`}
                >
                  {displayName}
                </span>
                <span className="block font-mono text-[11px] font-bold text-[#245C3A] tabular-nums">
                  ₹{crop.modalPrice}/kg
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filtered Price-First Cards */}
      {filteredList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-2">
          {filteredList.map((crop) => {
            const name = t.cropNames[crop.id] || crop.name;
            const isFav = favoriteCropIds.includes(crop.id);
            const active = selectedCrop.id === crop.id;
            const positive = crop.priceChangePercent >= 0;
            return (
              <div
                key={crop.id}
                className={`rounded-2xl border p-3.5 flex flex-col justify-between transition-colors ${
                  active
                    ? 'border-[#245C3A] bg-[#EAF3E8]/30'
                    : 'border-[#E4E9E0] bg-[#FAF9F4] hover:bg-white'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAndScroll(crop.id)}
                      className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                    >
                      <CropImage
                        src={crop.image}
                        alt={name}
                        className="w-11 h-11 rounded-xl border border-[#E4E9E0] shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#202820] truncate">{name}</h3>
                        <p className="text-[11px] text-[#6B756A] truncate">
                          {t.marketNames[crop.marketId] || crop.market}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleFavorite(crop.id)}
                      aria-label={isFav ? `Remove ${name} from My Crops` : `Save ${name} to My Crops`}
                      className="p-1.5 rounded-lg text-[#245C3A] hover:bg-[#EAF3E8] cursor-pointer shrink-0"
                    >
                      {isFav ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : (
                        <Bookmark className="w-4 h-4 text-[#6B756A]" />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-2xl font-bold text-[#202820] tabular-nums">
                      ₹{crop.modalPrice}
                      <span className="text-xs font-normal text-[#6B756A]">/kg</span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums ${
                        positive ? 'text-[#245C3A]' : 'text-amber-700'
                      }`}
                    >
                      {positive ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {positive ? '+' : ''}
                      {crop.priceChangePercent}%
                    </span>
                  </div>

                  <p className="mt-1 font-mono text-[11px] text-[#6B756A] tabular-nums">
                    Range ₹{crop.minimumPrice}–₹{crop.maximumPrice}/kg · {crop.updatedAt}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectAndScroll(crop.id)}
                  className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#245C3A] text-white border-[#245C3A]'
                      : 'bg-white text-[#245C3A] border-[#E4E9E0] hover:border-[#245C3A]'
                  }`}
                >
                  {t.viewDetails}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      {/* Page Header & Filter Controls */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#202820]">{t.navMarkets}</h1>
            <p className="text-xs sm:text-sm text-[#6B756A]">
              Separate Vegetable (10) and Fruit (10) market intelligence · {t.demoBannerPrefix}
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs text-[#6B756A] bg-[#FAF9F4] border border-[#E4E9E0] px-3 py-1.5 rounded-xl">
            <Info className="w-3.5 h-3.5 text-[#245C3A] shrink-0" />
            <span>Demo / Sample APMC rates</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Category Switcher */}
          <div className="md:col-span-5 flex flex-wrap gap-1.5">
            {(
              [
                {key: 'all', label: `${t.allCrops} (20)`},
                {key: 'vegetable', label: `${t.vegetables} (10)`},
                {key: 'fruit', label: `${t.fruits} (10)`},
                {key: 'favorites', label: `${t.myCrops} (${favoriteCropIds.length})`},
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategoryTab(tab.key)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  categoryTab === tab.key
                    ? 'bg-[#245C3A] text-white border-[#245C3A]'
                    : 'bg-[#FAF9F4] text-[#202820] border-[#E4E9E0] hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="md:col-span-3 relative">
            <Search className="w-4 h-4 text-[#6B756A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm text-[#202820] focus:outline-none focus:ring-2 focus:ring-[#245C3A]"
            />
          </div>

          {/* Market Filter */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by market"
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820]"
            >
              <option value="all">All Markets</option>
              {KARNATAKA_MARKETS.map((m) => (
                <option key={m.id} value={m.id}>
                  {t.marketNames[m.id] || m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Mode */}
          <div className="md:col-span-2">
            <select
              aria-label={t.sortBy}
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="w-full px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820]"
            >
              <option value="modal_desc">{t.sortModalDesc}</option>
              <option value="modal_asc">{t.sortModalAsc}</option>
              <option value="change_desc">{t.sortChangeDesc}</option>
              <option value="name_asc">{t.sortNameAsc}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Category 1: VEGETABLES (Always clearly separated from Fruits) */}
      {(categoryTab === 'all' || categoryTab === 'vegetable' || categoryTab === 'favorites') &&
        (visibleVegetables.length > 0 || categoryTab !== 'favorites') &&
        renderCategoryTabsAndGrid(
          t.vegetablesTitle,
          t.vegetablesSubtitle,
          allVegetables,
          visibleVegetables,
        )}

      {/* Category 2: FRUITS (Always clearly separated from Vegetables) */}
      {(categoryTab === 'all' || categoryTab === 'fruit' || categoryTab === 'favorites') &&
        (visibleFruits.length > 0 || categoryTab !== 'favorites') &&
        renderCategoryTabsAndGrid(
          t.fruitsTitle,
          t.fruitsSubtitle,
          allFruits,
          visibleFruits,
        )}

      {/* Empty Search / Filter State */}
      {combinedVisible.length === 0 && (
        <div className="bg-white border border-[#E4E9E0] rounded-2xl p-8 text-center">
          <Sprout className="w-8 h-8 text-[#245C3A] mx-auto" />
          <p className="mt-2 text-base font-semibold text-[#202820]">{t.noSearchTitle}</p>
          <p className="mt-1 text-sm text-[#6B756A]">{t.noSearchSub}</p>
          <button
            type="button"
            onClick={() => {
              onSearchQueryChange('');
              setCategoryTab('all');
              setMarketFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-[#245C3A] text-white text-sm font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Selected Product Detail Panel (Smooth tab-driven update without page reload) */}
      <div id="crop-detail-panel-anchor" className="scroll-mt-24">
        <ProductDetailPanel
          crop={selectedCrop}
          t={t}
          language={language}
          location={location}
          isFavorite={favoriteCropIds.includes(selectedCrop.id)}
          cropAlerts={priceAlerts.filter((a) => a.cropId === selectedCrop.id)}
          onToggleFavorite={onToggleFavorite}
          onOpenAlertModal={onOpenAlertModal}
          onSelectCrop={onSelectCrop}
          onNotify={onNotify}
          audioActiveKey={audioActiveKey}
          audioLoadingKey={audioLoadingKey}
          onListen={onListen}
        />
      </div>

      {/* Summary Market Price Table (Desktop & Tablet) */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#202820]">
              All Listed Market Prices ({combinedVisible.length})
            </h2>
            <p className="text-xs text-[#6B756A]">{t.demoDisclaimer}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E4E9E0] text-xs font-semibold text-[#6B756A] uppercase tracking-wider">
                <th className="py-2.5 pr-4">Crop</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Market</th>
                <th className="py-2.5 px-3">Modal Price</th>
                <th className="py-2.5 px-3">Min – Max</th>
                <th className="py-2.5 pl-3 text-right">7D Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E9E0] text-sm">
              {combinedVisible.map((crop) => {
                const positive = crop.priceChangePercent >= 0;
                return (
                  <tr
                    key={crop.id}
                    onClick={() => handleSelectAndScroll(crop.id)}
                    className={`cursor-pointer hover:bg-[#FAF9F4] ${
                      selectedCrop.id === crop.id ? 'bg-[#EAF3E8]/35' : ''
                    }`}
                  >
                    <td className="py-3 pr-4 font-semibold text-[#202820]">
                      {t.cropNames[crop.id] || crop.name}
                    </td>
                    <td className="py-3 px-3 text-xs text-[#6B756A]">
                      {crop.category === 'vegetable' ? t.vegetables : t.fruits}
                    </td>
                    <td className="py-3 px-3 text-xs text-[#6B756A]">
                      {t.marketNames[crop.marketId] || crop.market}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#202820] tabular-nums">
                      ₹{crop.modalPrice}/kg
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-[#6B756A] tabular-nums">
                      ₹{crop.minimumPrice}–₹{crop.maximumPrice}
                    </td>
                    <td
                      className={`py-3 pl-3 text-right font-mono text-xs font-semibold tabular-nums ${
                        positive ? 'text-[#245C3A]' : 'text-amber-700'
                      }`}
                    >
                      {positive ? '+' : ''}
                      {crop.priceChangePercent}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
