import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Minus,
  Sprout,
  Trash2,
} from 'lucide-react';
import {useMemo} from 'react';
import {TranslationPack} from '../data/translations';
import {CropProduct, MarketSyncStatus, NavTab, PriceAlert} from '../types/krishi';
import {CropImage} from './CropImage';

interface MyCropsViewProps {
  t: TranslationPack;
  products: CropProduct[];
  marketStatus: MarketSyncStatus;
  favoriteCropIds: string[];
  priceAlerts: PriceAlert[];
  onToggleFavorite: (cropId: string) => void;
  onOpenCropDetail: (cropId: string) => void;
  onOpenAlertModal: (crop: CropProduct) => void;
  onToggleAlert: (alertId: string) => void;
  onDeleteAlert: (alertId: string) => void;
  onNavigate: (tab: NavTab) => void;
}

export function MyCropsView({
  t,
  products,
  marketStatus,
  favoriteCropIds,
  priceAlerts,
  onToggleFavorite,
  onOpenCropDetail,
  onOpenAlertModal,
  onToggleAlert,
  onDeleteAlert,
  onNavigate,
}: MyCropsViewProps) {
  const savedCrops = useMemo(
    () =>
      favoriteCropIds
        .map((id) => products.find((c) => c.id === id))
        .filter((c): c is CropProduct => Boolean(c)),
    [products, favoriteCropIds],
  );

  const savedVegetablesCount = useMemo(
    () => savedCrops.filter((c) => c.category === 'vegetable').length,
    [savedCrops],
  );
  const savedFruitsCount = useMemo(
    () => savedCrops.filter((c) => c.category === 'fruit').length,
    [savedCrops],
  );

  const isAlertTriggered = (alert: PriceAlert, crop?: CropProduct) => {
    if (!crop || !alert.enabled) return false;
    return alert.condition === 'above'
      ? crop.modalPrice >= alert.targetPrice
      : crop.modalPrice <= alert.targetPrice;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202820]">{t.navMyCrops}</h1>
          <p className="text-sm text-[#6B756A]">
            Your personal watchlist of vegetables &amp; fruits. These crops also personalize your
            weather advisories and daily audio briefing.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-[#EAF3E8] text-[#245C3A] font-semibold">
              {savedVegetablesCount} Vegetables
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#FAF9F4] border border-[#E4E9E0] text-[#202820] font-semibold">
              {savedFruitsCount} Fruits
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#FAF9F4] border border-[#E4E9E0] text-[#6B756A]">
              {marketStatus.sourceLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('markets')}
          className="px-4 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] cursor-pointer"
        >
          Browse All {products.length} Crops
        </button>
      </section>

      {/* Saved Watchlist */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[#202820]">
          Saved Crops ({savedCrops.length})
        </h2>

        {savedCrops.length === 0 ? (
          <div className="bg-white border border-[#E4E9E0] rounded-2xl p-8 text-center space-y-2">
            <Sprout className="w-9 h-9 text-[#245C3A] mx-auto" />
            <p className="text-base font-bold text-[#202820]">0 crops tracked yet</p>
            <p className="text-sm text-[#6B756A] max-w-md mx-auto">
              Start by selecting the vegetables and fruits you grow from our {products.length}-crop
              Indian marketplace. Your dashboard, alerts, and Gemini briefing will automatically
              adapt to your selection.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="mt-3 px-5 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] cursor-pointer"
            >
              Add Your First Crop
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedCrops.map((crop) => {
              const name = t.cropNames[crop.id] || crop.name;
              const hasComparable = Boolean(crop.hasComparableHistory);
              const positive = crop.priceChangePercent >= 0;
              const alertsForCrop = priceAlerts.filter((a) => a.cropId === crop.id);
              const hitAlert = alertsForCrop.find((a) => isAlertTriggered(a, crop));

              return (
                <div
                  key={crop.id}
                  className="bg-white border border-[#E4E9E0] rounded-2xl p-4 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenCropDetail(crop.id)}
                        className="flex items-center gap-3 text-left cursor-pointer min-w-0"
                      >
                        <CropImage
                          src={crop.image}
                          alt={name}
                          category={crop.category}
                          className="w-14 h-14 rounded-xl border border-[#E4E9E0] shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-[#202820] truncate">{name}</h3>
                          <p className="text-xs text-[#6B756A] truncate">
                            {crop.variety} · {t.marketNames[crop.marketId] || crop.market}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleFavorite(crop.id)}
                        aria-label={`Remove ${name} from My Crops`}
                        className="p-2 rounded-lg text-[#6B756A] hover:text-red-700 hover:bg-[#FAF9F4] cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between gap-2">
                      <div>
                        <span className="font-mono text-2xl font-bold text-[#202820] tabular-nums">
                          ₹{crop.modalPrice}
                          <span className="text-xs font-normal text-[#6B756A]">/kg</span>
                        </span>
                        <span className="ml-2 font-mono text-xs text-[#6B756A] tabular-nums">
                          (₹{Math.round(crop.modalPriceQuintal ?? crop.modalPrice * 100).toLocaleString('en-IN')}/qtl)
                        </span>
                      </div>

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
                        <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-[#6B756A]">
                          <Minus className="w-3 h-3" />
                          <span>Reference</span>
                        </span>
                      )}
                    </div>

                    {hitAlert ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#245C3A]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Target reached (₹{hitAlert.targetPrice}/kg)
                      </p>
                    ) : alertsForCrop.length > 0 ? (
                      <p className="mt-2 text-xs text-[#6B756A] font-mono tabular-nums">
                        Waiting for target ₹{alertsForCrop[0].targetPrice}/kg
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-[#6B756A]">No price alert set yet</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-[#E4E9E0]">
                    <button
                      type="button"
                      onClick={() => onOpenCropDetail(crop.id)}
                      className="flex-1 py-2 rounded-xl bg-[#FAF9F4] border border-[#E4E9E0] text-xs font-semibold text-[#202820] hover:bg-[#EAF3E8] cursor-pointer"
                    >
                      {t.viewDetails}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAlertModal(crop)}
                      className="px-3 py-2 rounded-xl bg-[#245C3A] text-white text-xs font-semibold hover:bg-[#1d4b2f] cursor-pointer"
                    >
                      {t.setPriceAlert}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Price Alerts List */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-[#245C3A]" />
            <h2 className="text-lg font-bold text-[#202820]">
              Price Alerts ({priceAlerts.length})
            </h2>
          </div>
          {products.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenAlertModal(savedCrops[0] || products[0])}
              className="px-3.5 py-2 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-xs font-semibold text-[#202820] hover:bg-[#EAF3E8] cursor-pointer"
            >
              + {t.setPriceAlert}
            </button>
          )}
        </div>

        {priceAlerts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[#6B756A]">{t.noAlertsTitle}</p>
            {products.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenAlertModal(savedCrops[0] || products[0])}
                className="mt-3 px-4 py-2 rounded-xl bg-[#245C3A] text-white text-xs font-semibold cursor-pointer"
              >
                {t.noAlertsAction}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#E4E9E0]">
            {priceAlerts.map((alert) => {
              const crop = products.find((c) => c.id === alert.cropId);
              const name = crop ? t.cropNames[crop.id] || crop.name : alert.cropId;
              const triggered = isAlertTriggered(alert, crop);
              return (
                <div
                  key={alert.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#202820]">{name}</span>
                      <span className="font-mono text-xs text-[#245C3A] font-semibold tabular-nums">
                        {alert.condition === 'above' ? '≥' : '≤'} ₹{alert.targetPrice}/kg
                      </span>
                      {triggered && (
                        <span className="text-[11px] font-semibold text-[#245C3A] bg-[#EAF3E8] px-2 py-0.5 rounded-md">
                          Target reached
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B756A] mt-0.5">
                      Current ₹{crop?.modalPrice ?? '—'}/kg · Channel:{' '}
                      {alert.channel === 'app'
                        ? 'In-app'
                        : alert.channel === 'sms_demo'
                          ? 'SMS preference'
                          : 'WhatsApp preference'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#202820] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alert.enabled}
                        onChange={() => onToggleAlert(alert.id)}
                        className="accent-[#245C3A]"
                      />
                      <span>{alert.enabled ? 'Active' : 'Paused'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onDeleteAlert(alert.id)}
                      aria-label="Delete alert"
                      className="p-1.5 rounded-lg text-[#6B756A] hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
