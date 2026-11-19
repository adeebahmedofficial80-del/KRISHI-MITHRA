import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Sprout,
  Trash2,
} from 'lucide-react';
import {useMemo} from 'react';
import {TranslationPack} from '../data/translations';
import {marketProvider} from '../services/marketProvider';
import {CropProduct, NavTab, PriceAlert} from '../types/krishi';
import {CropImage} from './CropImage';

interface MyCropsViewProps {
  t: TranslationPack;
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
  favoriteCropIds,
  priceAlerts,
  onToggleFavorite,
  onOpenCropDetail,
  onOpenAlertModal,
  onToggleAlert,
  onDeleteAlert,
  onNavigate,
}: MyCropsViewProps) {
  const allProducts = useMemo(() => marketProvider.getAllProducts(), []);

  const savedCrops = useMemo(
    () =>
      favoriteCropIds
        .map((id) => allProducts.find((c) => c.id === id))
        .filter((c): c is CropProduct => Boolean(c)),
    [allProducts, favoriteCropIds],
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
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#202820]">{t.navMyCrops}</h1>
          <p className="text-sm text-[#6B756A]">
            Track your selected vegetables & fruits and manage target price alerts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('markets')}
          className="px-4 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] cursor-pointer"
        >
          Browse All 20 Crops
        </button>
      </section>

      {/* Saved Watchlist */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[#202820]">
          Saved Crops ({savedCrops.length})
        </h2>

        {savedCrops.length === 0 ? (
          <div className="bg-white border border-[#E4E9E0] rounded-2xl p-8 text-center">
            <Sprout className="w-8 h-8 text-[#245C3A] mx-auto" />
            <p className="mt-2 text-base font-semibold text-[#202820]">{t.noCropsTitle}</p>
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="mt-4 px-4 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold cursor-pointer"
            >
              {t.noCropsAction}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedCrops.map((crop) => {
              const name = t.cropNames[crop.id] || crop.name;
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
                        className="flex items-center gap-3 text-left cursor-pointer"
                      >
                        <CropImage
                          src={crop.image}
                          alt={name}
                          className="w-14 h-14 rounded-xl border border-[#E4E9E0] shrink-0"
                        />
                        <div>
                          <h3 className="text-base font-bold text-[#202820]">{name}</h3>
                          <p className="text-xs text-[#6B756A]">
                            {t.marketNames[crop.marketId] || crop.market}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleFavorite(crop.id)}
                        aria-label={`Remove ${name} from My Crops`}
                        className="p-2 rounded-lg text-[#6B756A] hover:text-red-700 hover:bg-[#FAF9F4] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between">
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
                        {crop.priceChangePercent}% (7d)
                      </span>
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
          <button
            type="button"
            onClick={() => onOpenAlertModal(savedCrops[0] || allProducts[0])}
            className="px-3.5 py-2 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-xs font-semibold text-[#202820] hover:bg-[#EAF3E8] cursor-pointer"
          >
            + {t.setPriceAlert}
          </button>
        </div>

        {priceAlerts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[#6B756A]">{t.noAlertsTitle}</p>
            <button
              type="button"
              onClick={() => onOpenAlertModal(savedCrops[0] || allProducts[0])}
              className="mt-3 px-4 py-2 rounded-xl bg-[#245C3A] text-white text-xs font-semibold cursor-pointer"
            >
              {t.noAlertsAction}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E9E0]">
            {priceAlerts.map((alert) => {
              const crop = allProducts.find((c) => c.id === alert.cropId);
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
                          ? 'SMS (demo preference)'
                          : 'WhatsApp (demo preference)'}
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
