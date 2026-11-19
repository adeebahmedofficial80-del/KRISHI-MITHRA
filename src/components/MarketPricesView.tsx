import {
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Database,
  Info,
  Minus,
  RefreshCw,
  Search,
  Sprout,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {TranslationPack} from '../data/translations';
import {
  CropProduct,
  LanguageCode,
  LocationOption,
  MarketSyncStatus,
  PriceAlert,
  PriceDisplayUnit,
} from '../types/krishi';
import {CropImage} from './CropImage';
import {ProductDetailPanel} from './ProductDetailPanel';

interface MarketPricesViewProps {
  t: TranslationPack;
  language: LanguageCode;
  location: LocationOption;
  products: CropProduct[];
  marketStatus: MarketSyncStatus;
  marketSyncing: boolean;
  onRefreshMarket: () => void;
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

function formatPriceValue(kgPrice: number, quintalPrice: number | undefined, unit: PriceDisplayUnit): string {
  if (unit === 'quintal') {
    const qtl = Math.round(quintalPrice ?? kgPrice * 100);
    return `₹${qtl.toLocaleString('en-IN')}`;
  }
  return `₹${kgPrice}`;
}

export function MarketPricesView({
  t,
  language,
  location,
  products,
  marketStatus,
  marketSyncing,
  onRefreshMarket,
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
  const [sortMode, setSortMode] = useState<SortMode>('name_asc');
  const [priceUnit, setPriceUnit] = useState<PriceDisplayUnit>('kg');

  const allVegetables = useMemo(
    () => products.filter((p) => p.category === 'vegetable'),
    [products],
  );
  const allFruits = useMemo(
    () => products.filter((p) => p.category === 'fruit'),
    [products],
  );

  const selectedCrop = useMemo(
    () => products.find((p) => p.id === selectedCropId) || products[0],
    [selectedCropId, products],
  );

  // Dynamically collect all available mandis across current products + farmer district
  const availableMarkets = useMemo(() => {
    const map = new Map<string, string>();
    for (const crop of products) {
      if (crop.market) {
        map.set(crop.market.toLowerCase(), crop.market);
      }
      for (const comp of crop.marketComparisons) {
        if (comp.marketName) {
          map.set(comp.marketName.toLowerCase(), comp.marketName);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filterAndSort = (list: CropProduct[]) => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = list.filter((crop) => {
      const localName = (t.cropNames[crop.id] || '').toLowerCase();
      const regionalMatch = (crop.regionalNames || []).some((rn) =>
        rn.toLowerCase().includes(q),
      );
      const varietiesMatch = (crop.varieties || []).some((v) =>
        v.toLowerCase().includes(q),
      );
      const matchesQuery =
        !q ||
        crop.name.toLowerCase().includes(q) ||
        localName.includes(q) ||
        crop.variety.toLowerCase().includes(q) ||
        crop.market.toLowerCase().includes(q) ||
        (crop.marketDistrict || '').toLowerCase().includes(q) ||
        (crop.marketState || '').toLowerCase().includes(q) ||
        regionalMatch ||
        varietiesMatch;

      const matchesFav =
        categoryTab !== 'favorites' || favoriteCropIds.includes(crop.id);

      const matchesMarket =
        marketFilter === 'all' ||
        crop.market.toLowerCase() === marketFilter.toLowerCase() ||
        crop.marketComparisons.some(
          (m) => m.marketName.toLowerCase() === marketFilter.toLowerCase(),
        );

      return matchesQuery && matchesFav && matchesMarket;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'modal_desc') return b.modalPrice - a.modalPrice;
      if (sortMode === 'modal_asc') return a.modalPrice - b.modalPrice;
      if (sortMode === 'change_desc') {
        const aVal = a.hasComparableHistory ? a.priceChangePercent : -9999;
        const bVal = b.hasComparableHistory ? b.priceChangePercent : -9999;
        return bVal - aVal;
      }
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

  const unitSuffix = priceUnit === 'quintal' ? '/qtl' : '/kg';

  const renderCategoryGrid = (
    title: string,
    subtitle: string,
    totalCount: number,
    filteredList: CropProduct[],
  ) => (
    <section className="space-y-4 bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#E4E9E0] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#202820]">{title}</h2>
            <span className="font-mono text-xs font-semibold text-[#245C3A] bg-[#EAF3E8] px-2.5 py-0.5 rounded-md tabular-nums">
              {filteredList.length} / {totalCount}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B756A] mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs text-[#6B756A]">
          Tap any crop card to inspect detailed rates, nutrition &amp; storage
        </span>
      </div>

      {filteredList.length === 0 ? (
        <p className="text-sm text-[#6B756A] py-4">
          No crops match your current filter in this category.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredList.map((crop) => {
            const name = t.cropNames[crop.id] || crop.name;
            const isFav = favoriteCropIds.includes(crop.id);
            const active = selectedCrop?.id === crop.id;
            const hasComparable = Boolean(crop.hasComparableHistory);
            const positive = crop.priceChangePercent >= 0;
            const isLive = crop.dataSource === 'live_agmarknet';
            const isCached = crop.dataSource === 'cached_agmarknet';

            return (
              <div
                key={crop.id}
                className={`rounded-2xl border p-3.5 flex flex-col justify-between transition-all ${
                  active
                    ? 'border-[#245C3A] bg-[#EAF3E8]/35 ring-1 ring-[#245C3A]/30'
                    : 'border-[#E4E9E0] bg-[#FAF9F4] hover:bg-white hover:border-[#245C3A]/40'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAndScroll(crop.id)}
                      className="flex items-center gap-2.5 text-left cursor-pointer min-w-0 flex-1"
                    >
                      <CropImage
                        src={crop.image}
                        alt={name}
                        category={crop.category}
                        className="w-12 h-12 rounded-xl border border-[#E4E9E0] shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#202820] truncate">{name}</h3>
                        <p className="text-[11px] text-[#6B756A] truncate">
                          {crop.variety} · {t.marketNames[crop.marketId] || crop.market}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleFavorite(crop.id)}
                      aria-label={isFav ? `Remove ${name} from My Crops` : `Add ${name} to My Crops`}
                      title={isFav ? 'Saved in My Crops' : 'Add to My Crops'}
                      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer shrink-0 transition-colors ${
                        isFav
                          ? 'bg-[#245C3A] text-white border-[#245C3A]'
                          : 'bg-white text-[#245C3A] border-[#E4E9E0] hover:bg-[#EAF3E8]'
                      }`}
                    >
                      {isFav ? (
                        <>
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-2xl font-bold text-[#202820] tabular-nums">
                      {formatPriceValue(crop.modalPrice, crop.modalPriceQuintal, priceUnit)}
                      <span className="text-xs font-normal text-[#6B756A]">{unitSuffix}</span>
                    </span>

                    {hasComparable ? (
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
                    ) : (
                      <span
                        title="No verified comparable prior-day observation"
                        className="inline-flex items-center gap-0.5 font-mono text-[11px] text-[#6B756A]"
                      >
                        <Minus className="w-3 h-3" />
                        <span>No prior diff</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#6B756A]">
                    <span className="font-mono tabular-nums truncate">
                      {formatPriceValue(crop.minimumPrice, crop.minimumPriceQuintal, priceUnit)}–
                      {formatPriceValue(crop.maximumPrice, crop.maximumPriceQuintal, priceUnit)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        isLive
                          ? 'bg-[#EAF3E8] text-[#245C3A]'
                          : isCached
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-white border border-[#E4E9E0] text-[#6B756A]'
                      }`}
                    >
                      {isLive ? 'AGMARKNET' : isCached ? 'Cached' : 'Reference'}
                    </span>
                  </div>
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
      {/* Page Header, AGMARKNET Status & Filter Controls */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#202820]">{t.navMarkets}</h1>
            <p className="text-xs sm:text-sm text-[#6B756A]">
              Pan-India Vegetable ({allVegetables.length}) &amp; Fruit ({allFruits.length}) Mandi
              Intelligence · {location.district}, {location.state}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Price Unit Switcher */}
            <div
              className="inline-flex rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-0.5"
              role="group"
              aria-label="Price display unit"
            >
              <button
                type="button"
                onClick={() => setPriceUnit('kg')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  priceUnit === 'kg'
                    ? 'bg-[#245C3A] text-white'
                    : 'text-[#6B756A] hover:text-[#202820]'
                }`}
              >
                ₹/kg
              </button>
              <button
                type="button"
                onClick={() => setPriceUnit('quintal')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  priceUnit === 'quintal'
                    ? 'bg-[#245C3A] text-white'
                    : 'text-[#6B756A] hover:text-[#202820]'
                }`}
              >
                ₹/Quintal
              </button>
            </div>

            <button
              type="button"
              disabled={marketSyncing}
              onClick={onRefreshMarket}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E9E0] bg-white text-xs font-semibold text-[#202820] hover:bg-[#FAF9F4] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#245C3A] ${marketSyncing ? 'animate-spin' : ''}`} />
              <span>{marketSyncing ? 'Syncing...' : 'Refresh Prices'}</span>
            </button>
          </div>
        </div>

        {/* Truthful Market Data Source Disclosure */}
        <div
          className={`rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
            marketStatus.sourceStatus === 'live_agmarknet' && !marketStatus.isStale
              ? 'bg-[#EAF3E8]/70 border-[#245C3A]/30 text-[#202820]'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2">
            {marketStatus.sourceStatus === 'live_agmarknet' ? (
              <Database className="w-4 h-4 text-[#245C3A] shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span>
              <strong>{marketStatus.sourceLabel}</strong>
              {marketStatus.observationDate ? ` · Arrival Date: ${marketStatus.observationDate}` : ''}
              {marketStatus.matchedCropCount > 0
                ? ` · ${marketStatus.matchedCropCount} crops matched from AGMARKNET`
                : ''}
              {marketStatus.staleReason ? ` · ${marketStatus.staleReason}` : ''}
            </span>
          </div>
          {marketStatus.lastSyncAt && (
            <span className="font-mono text-[11px] opacity-80">
              Synced: {new Date(marketStatus.lastSyncAt).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}
            </span>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Category Switcher */}
          <div className="md:col-span-5 flex flex-wrap gap-1.5">
            {(
              [
                {key: 'all', label: `${t.allCrops} (${products.length})`},
                {key: 'vegetable', label: `${t.vegetables} (${allVegetables.length})`},
                {key: 'fruit', label: `${t.fruits} (${allFruits.length})`},
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
              placeholder="Search crop, local name, variety, mandi..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm text-[#202820] focus:outline-none focus:ring-2 focus:ring-[#245C3A]"
            />
          </div>

          {/* Market Filter */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by mandi"
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820]"
            >
              <option value="all">All Markets</option>
              {availableMarkets.map((m) => (
                <option key={m} value={m}>
                  {m}
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
              <option value="name_asc">{t.sortNameAsc}</option>
              <option value="modal_desc">{t.sortModalDesc}</option>
              <option value="modal_asc">{t.sortModalAsc}</option>
              <option value="change_desc">{t.sortChangeDesc}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Selected Product Detail Panel (Sticky anchor at top for instant inspection) */}
      {selectedCrop && (
        <div id="crop-detail-panel-anchor" className="scroll-mt-24">
          <ProductDetailPanel
            crop={selectedCrop}
            allProducts={products}
            priceUnit={priceUnit}
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
      )}

      {/* Category 1: VEGETABLES (Always clearly separated from Fruits) */}
      {(categoryTab === 'all' || categoryTab === 'vegetable' || categoryTab === 'favorites') &&
        (visibleVegetables.length > 0 || categoryTab === 'vegetable') &&
        renderCategoryGrid(
          t.vegetablesTitle,
          `${allVegetables.length} major Indian vegetables · Add crops to personalize your dashboard & briefings`,
          allVegetables.length,
          visibleVegetables,
        )}

      {/* Category 2: FRUITS (Always clearly separated from Vegetables) */}
      {(categoryTab === 'all' || categoryTab === 'fruit' || categoryTab === 'favorites') &&
        (visibleFruits.length > 0 || categoryTab === 'fruit') &&
        renderCategoryGrid(
          t.fruitsTitle,
          `${allFruits.length} major Indian fruits · Tap any fruit for mandi rates, shelf life & nutrition`,
          allFruits.length,
          visibleFruits,
        )}

      {/* Empty Search / Filter State */}
      {combinedVisible.length === 0 && (
        <div className="bg-white border border-[#E4E9E0] rounded-2xl p-8 text-center">
          <Sprout className="w-8 h-8 text-[#245C3A] mx-auto" />
          <p className="mt-2 text-base font-semibold text-[#202820]">
            {categoryTab === 'favorites'
              ? 'You have not saved any crops yet'
              : t.noSearchTitle}
          </p>
          <p className="mt-1 text-sm text-[#6B756A]">
            {categoryTab === 'favorites'
              ? `Browse all ${products.length} Indian vegetables and fruits and tap "Add" on the crops you grow.`
              : t.noSearchSub}
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchQueryChange('');
              setCategoryTab('all');
              setMarketFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-[#245C3A] text-white text-sm font-semibold cursor-pointer"
          >
            {categoryTab === 'favorites' ? `Explore All ${products.length} Crops` : 'Reset Filters'}
          </button>
        </div>
      )}

      {/* Summary Market Price Table (Desktop & Tablet) */}
      {combinedVisible.length > 0 && (
        <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#202820]">
                All Listed Market Prices ({combinedVisible.length})
              </h2>
              <p className="text-xs text-[#6B756A]">
                {marketStatus.sourceLabel} · Showing prices in{' '}
                {priceUnit === 'quintal' ? '₹ per Quintal (100 kg)' : '₹ per kg'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4E9E0] text-xs font-semibold text-[#6B756A] uppercase tracking-wider">
                  <th className="py-2.5 pr-4">Crop</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Mandi</th>
                  <th className="py-2.5 px-3">Modal Price</th>
                  <th className="py-2.5 px-3">Min – Max</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 pl-3 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E9E0] text-sm">
                {combinedVisible.map((crop) => {
                  const hasComparable = Boolean(crop.hasComparableHistory);
                  const positive = crop.priceChangePercent >= 0;
                  return (
                    <tr
                      key={crop.id}
                      onClick={() => handleSelectAndScroll(crop.id)}
                      className={`cursor-pointer hover:bg-[#FAF9F4] ${
                        selectedCrop?.id === crop.id ? 'bg-[#EAF3E8]/35' : ''
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
                        {formatPriceValue(crop.modalPrice, crop.modalPriceQuintal, priceUnit)}
                        {unitSuffix}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-[#6B756A] tabular-nums">
                        {formatPriceValue(crop.minimumPrice, crop.minimumPriceQuintal, priceUnit)}–
                        {formatPriceValue(crop.maximumPrice, crop.maximumPriceQuintal, priceUnit)}
                      </td>
                      <td className="py-3 px-3 text-xs text-[#6B756A]">
                        {crop.dataSource === 'live_agmarknet'
                          ? 'AGMARKNET'
                          : crop.dataSource === 'cached_agmarknet'
                            ? 'Cached'
                            : 'Reference'}
                      </td>
                      <td
                        className={`py-3 pl-3 text-right font-mono text-xs font-semibold tabular-nums ${
                          !hasComparable
                            ? 'text-[#6B756A]'
                            : positive
                              ? 'text-[#245C3A]'
                              : 'text-amber-700'
                        }`}
                      >
                        {hasComparable
                          ? `${positive ? '+' : ''}${crop.priceChangePercent}%`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
