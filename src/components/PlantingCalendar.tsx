import React, {useMemo, useState} from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  CloudRain,
  Sprout,
  Sun,
} from 'lucide-react';
import {
  evaluateWeatherReadiness,
  getCropSchedule,
  MONTH_SHORT_LABELS,
} from '../data/plantingCalendar';
import {
  CropProduct,
  LocationOption,
  NavTab,
  PlantingReadinessKind,
  WeatherSnapshot,
} from '../types/krishi';
import {CropImage} from './CropImage';

interface PlantingCalendarProps {
  savedCrops: CropProduct[];
  allProducts: CropProduct[];
  weather: WeatherSnapshot | null;
  location: LocationOption;
  onOpenCropDetail: (cropId: string) => void;
  onNavigate: (tab: NavTab) => void;
}

type FilterMode = 'all' | 'sow' | 'harvest';

const DEFAULT_REGIONAL_PREVIEW_IDS = ['tomato', 'onion', 'potato', 'beans', 'banana', 'mango'];

export const PlantingCalendar: React.FC<PlantingCalendarProps> = ({
  savedCrops,
  allProducts,
  weather,
  location,
  onOpenCropDetail,
  onNavigate,
}) => {
  const currentMonth = new Date().getMonth() + 1; // 1..12
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [expandedCropId, setExpandedCropId] = useState<string | null>(null);
  const [previewRegional, setPreviewRegional] = useState<boolean>(false);

  const isCurrentMonth = selectedMonth === currentMonth;

  const activeCrops = useMemo(() => {
    if (savedCrops.length > 0 && !previewRegional) {
      return savedCrops;
    }
    if (savedCrops.length === 0 && !previewRegional) {
      return [];
    }
    return DEFAULT_REGIONAL_PREVIEW_IDS.map((id) =>
      allProducts.find((p) => p.id === id),
    ).filter((p): p is CropProduct => Boolean(p));
  }, [savedCrops, previewRegional, allProducts]);

  const rows = useMemo(() => {
    return activeCrops
      .map((crop) => {
        const schedule = getCropSchedule(crop.id);
        if (!schedule) return null;
        const readiness = evaluateWeatherReadiness(
          schedule,
          weather,
          selectedMonth,
          isCurrentMonth,
        );
        const isSow = schedule.sowingMonths.includes(selectedMonth);
        const isHarvest = schedule.harvestMonths.includes(selectedMonth);
        return {crop, schedule, readiness, isSow, isHarvest};
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [activeCrops, weather, selectedMonth, isCurrentMonth]);

  const filteredRows = useMemo(() => {
    if (filterMode === 'sow') return rows.filter((r) => r.isSow);
    if (filterMode === 'harvest') return rows.filter((r) => r.isHarvest);
    return rows;
  }, [rows, filterMode]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      sow: rows.filter((r) => r.isSow).length,
      harvest: rows.filter((r) => r.isHarvest).length,
    }),
    [rows],
  );

  const renderReadinessMeta = (kind: PlantingReadinessKind, label: string) => {
    switch (kind) {
      case 'ideal_sow':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B5E20]">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#2E7D32]" />
            <span>{label}</span>
          </span>
        );
      case 'harvest_ready':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
            <Sun className="h-3.5 w-3.5 shrink-0 text-[#D97706]" />
            <span>{label}</span>
          </span>
        );
      case 'caution_weather':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B91C1C]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
            <span>{label}</span>
          </span>
        );
      case 'active_growing':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#245C3A]">
            <Sprout className="h-3.5 w-3.5 shrink-0 text-[#2E7D32]" />
            <span>{label}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7A6F]">
            <Clock className="h-3.5 w-3.5 shrink-0 text-[#87948A]" />
            <span>{label}</span>
          </span>
        );
    }
  };

  return (
    <section
      aria-label="Planting and Harvesting Calendar"
      className="rounded-2xl border border-[#E4E9E0] bg-white p-5 sm:p-6 shadow-[0_2px_10px_rgba(24,38,28,0.04)]"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-[#EEF2EA] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[#245C3A]">
            <Calendar className="h-4.5 w-4.5" />
            <h2 className="text-lg font-bold tracking-tight text-[#18261C]">
              Planting &amp; Harvesting Calendar
            </h2>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#5A6B5F]">
            {location.district}, {location.state} · {MONTH_SHORT_LABELS[selectedMonth - 1]}{' '}
            {isCurrentMonth ? '(This Month · Live Weather Checked)' : '(Seasonal Outlook)'}
            {weather && isCurrentMonth && weather.currentTemperature !== null
              ? ` · ${Math.round(weather.currentTemperature)}°C`
              : ''}
            {weather && isCurrentMonth && weather.rainProbability !== null
              ? `, ${weather.rainProbability}% rain`
              : ''}
          </p>
        </div>

        {/* Segmented Filter Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              {id: 'all', label: `All (${counts.all})`},
              {id: 'sow', label: `Sow (${counts.sow})`},
              {id: 'harvest', label: `Harvest (${counts.harvest})`},
            ] as const
          ).map((tab) => {
            const active = filterMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#245C3A] text-white'
                    : 'bg-[#F3F6F0] text-[#425448] hover:bg-[#E7EDE3]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive 12-Month Selector Strip */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6A7B6F]">
            Select Month to Inspect Windows
          </span>
          <div className="flex items-center gap-4 text-[11px] text-[#5A6B5F]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#245C3A]" />
              Sowing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#D97706]" />
              Harvest
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#84A98C]" />
              Both
            </span>
          </div>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {MONTH_SHORT_LABELS.map((label, idx) => {
            const m = idx + 1;
            const isSelected = m === selectedMonth;
            const isNow = m === currentMonth;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedMonth(m)}
                className={`relative rounded-lg py-1.5 text-center text-xs font-semibold transition-all cursor-pointer border ${
                  isSelected
                    ? 'border-[#245C3A] bg-[#245C3A] text-white shadow-xs'
                    : isNow
                      ? 'border-[#245C3A]/50 bg-[#EDF4EE] text-[#1D4B2F] hover:bg-[#E1EDE3]'
                      : 'border-transparent bg-[#F7F8F4] text-[#4E5F53] hover:bg-[#ECEFE8]'
                }`}
              >
                {label}
                {isNow && !isSelected && (
                  <span
                    className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#245C3A]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State when Farmer has 0 Saved Crops */}
      {savedCrops.length === 0 && !previewRegional ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#D3DDD0] bg-[#F7F8F4] p-6 text-center">
          <Sprout className="mx-auto h-7 w-7 text-[#245C3A]" />
          <h3 className="mt-2.5 text-sm font-bold text-[#18261C]">
            Save your crops to personalize your 12-month planting timeline
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-[#5A6B5F]">
            Once you add vegetables or fruits to My Crops, we automatically align sowing and
            harvesting windows with live {location.district} rainfall and temperature forecasts.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('my-crops')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#245C3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C4A2E] cursor-pointer"
            >
              Select My Crops
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewRegional(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFD9CC] bg-white px-4 py-2 text-xs font-semibold text-[#2E4235] hover:bg-[#F3F6F0] cursor-pointer"
            >
              Preview Regional Staples
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {previewRegional && savedCrops.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F7F8F4] px-3.5 py-2 text-xs text-[#4C5D51] border border-[#E4E9E0]">
              <span>
                Showing common {location.state} staple crops. Save your own crops to customize this
                calendar.
              </span>
              <button
                type="button"
                onClick={() => onNavigate('my-crops')}
                className="font-semibold text-[#245C3A] hover:underline cursor-pointer"
              >
                Add My Crops →
              </button>
            </div>
          )}

          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-[#E4E9E0] bg-[#F7F8F4] px-4 py-6 text-center text-xs text-[#5A6B5F]">
              None of your tracked crops have a primary{' '}
              {filterMode === 'sow' ? 'sowing' : 'harvest'} window in{' '}
              {MONTH_SHORT_LABELS[selectedMonth - 1]}. Try selecting another month or switch back to{' '}
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="font-semibold text-[#245C3A] underline cursor-pointer"
              >
                All crops
              </button>
              .
            </div>
          ) : (
            <div className="divide-y divide-[#EEF2EA] rounded-xl border border-[#E4E9E0]">
              {filteredRows.map(({crop, schedule, readiness}) => {
                const isExpanded = expandedCropId === crop.id;
                return (
                  <div key={crop.id} className="bg-white first:rounded-t-xl last:rounded-b-xl">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedCropId(isExpanded ? null : crop.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedCropId(isExpanded ? null : crop.id);
                        }
                      }}
                      className="grid grid-cols-1 lg:grid-cols-[200px_1fr_215px] gap-3 items-center px-3.5 py-3 hover:bg-[#FAFBFA] transition-colors cursor-pointer"
                    >
                      {/* Crop Identity */}
                      <div className="flex items-center gap-3 min-w-0">
                        <CropImage
                          src={crop.image}
                          alt={crop.name}
                          category={crop.category}
                          className="h-9 w-9 shrink-0 rounded-lg object-cover border border-[#E4E9E0]"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[#18261C]">
                            {crop.name}
                          </div>
                          <div className="truncate text-[11px] text-[#64756A]">
                            {schedule.seasonLabel} · {schedule.daysToHarvest}
                          </div>
                        </div>
                      </div>

                      {/* 12-Month Visual Timeline Grid */}
                      <div className="grid grid-cols-12 gap-1 items-center">
                        {MONTH_SHORT_LABELS.map((mLabel, i) => {
                          const mNum = i + 1;
                          const canSow = schedule.sowingMonths.includes(mNum);
                          const canHarvest = schedule.harvestMonths.includes(mNum);
                          const isSelectedCol = mNum === selectedMonth;

                          let barClass = 'bg-[#EEF2EA]';
                          let titleText = `${mLabel}: Off-peak`;
                          if (canSow && canHarvest) {
                            barClass = 'bg-[#5B8E72]';
                            titleText = `${mLabel}: Sow & Harvest`;
                          } else if (canSow) {
                            barClass = 'bg-[#245C3A]';
                            titleText = `${mLabel}: Sowing window`;
                          } else if (canHarvest) {
                            barClass = 'bg-[#D97706]';
                            titleText = `${mLabel}: Harvest window`;
                          }

                          return (
                            <div
                              key={mLabel}
                              title={titleText}
                              className={`flex flex-col items-center gap-0.5 rounded py-1 ${
                                isSelectedCol ? 'ring-1.5 ring-[#18261C]/35 bg-[#F2F5EF]' : ''
                              }`}
                            >
                              <span className={`h-2.5 w-full rounded-[3px] ${barClass}`} />
                              <span className="text-[9px] font-medium text-[#7B8B80] lg:hidden">
                                {mLabel[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Weather Readiness & Expand Chevron */}
                      <div className="flex items-center justify-between lg:justify-end gap-2">
                        <div className="min-w-0">
                          {renderReadinessMeta(readiness.kind, readiness.label)}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-[#6B7A6F]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-[#6B7A6F]" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Weather & Agronomic Action Drawer */}
                    {isExpanded && (
                      <div className="border-t border-[#EEF2EA] bg-[#F7F8F4] px-4 py-3.5 text-xs text-[#314237]">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="rounded-lg bg-white p-3 border border-[#E4E9E0]">
                            <div className="flex items-center gap-1.5 font-semibold text-[#18261C]">
                              <CloudRain className="h-3.5 w-3.5 text-[#245C3A]" />
                              <span>
                                {isCurrentMonth
                                  ? 'Live Weather Assessment'
                                  : `${MONTH_SHORT_LABELS[selectedMonth - 1]} Readiness`}
                              </span>
                            </div>
                            <p className="mt-1 leading-relaxed text-[#4C5D51]">
                              {readiness.detail}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 border border-[#E4E9E0]">
                            <div className="font-semibold text-[#18261C]">
                              Sowing Guidance ({schedule.idealTempMinC}–{schedule.idealTempMaxC}°C)
                            </div>
                            <p className="mt-1 leading-relaxed text-[#4C5D51]">
                              {schedule.sowingTip}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 border border-[#E4E9E0]">
                            <div className="font-semibold text-[#18261C]">
                              Harvest &amp; Mandi Readiness
                            </div>
                            <p className="mt-1 leading-relaxed text-[#4C5D51]">
                              {schedule.harvestTip}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-[#5F7064]">
                            Sowing months:{' '}
                            <strong className="text-[#18261C]">
                              {schedule.sowingMonths
                                .map((m) => MONTH_SHORT_LABELS[m - 1])
                                .join(', ')}
                            </strong>{' '}
                            · Harvest months:{' '}
                            <strong className="text-[#18261C]">
                              {schedule.harvestMonths
                                .map((m) => MONTH_SHORT_LABELS[m - 1])
                                .join(', ')}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenCropDetail(crop.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#245C3A] hover:underline cursor-pointer"
                          >
                            Open Full Crop Guide &amp; Live Price
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
