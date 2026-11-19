import {AlertCircle, ArrowRight, Compass, Loader2, MapPin} from 'lucide-react';
import React, {useMemo, useState} from 'react';
import {
  ALL_INDIA_LOCATIONS,
  getLocationsByState,
  haversineKm,
  INDIAN_STATES,
} from '../data/locations';
import {LocationProfilePatch} from '../hooks/useKrishiStore';

const OFFICIAL_LOGO_URL = '/assets/aistudio/1b0ca66f-3975-4c99-adee-4dfad66df9ff_06020d3d.png';

interface LocationOnboardingScreenProps {
  farmerName: string;
  initialState?: string;
  initialLocationId?: string;
  onComplete: (patch: LocationProfilePatch) => Promise<void>;
}

export function LocationOnboardingScreen({
  farmerName,
  initialState,
  initialLocationId,
  onComplete,
}: LocationOnboardingScreenProps) {
  const defaultLoc =
    ALL_INDIA_LOCATIONS.find((l) => l.id === initialLocationId) || ALL_INDIA_LOCATIONS[0];

  const [selectedState, setSelectedState] = useState<string>(
    initialState && INDIAN_STATES.includes(initialState) ? initialState : defaultLoc.state,
  );

  const districtsInState = useMemo(() => getLocationsByState(selectedState), [selectedState]);

  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    const match = districtsInState.find((d) => d.id === defaultLoc.id);
    return match ? match.id : districtsInState[0]?.id || 'bengaluru-rural';
  });

  const activeLoc = useMemo(
    () =>
      districtsInState.find((d) => d.id === selectedLocationId) ||
      districtsInState[0] ||
      ALL_INDIA_LOCATIONS[0],
    [districtsInState, selectedLocationId],
  );

  const [selectedTaluk, setSelectedTaluk] = useState<string>(activeLoc.taluks[0] || '');
  const [selectedMandi, setSelectedMandi] = useState<string>(activeLoc.mandis[0] || '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStateChange = (nextState: string) => {
    setSelectedState(nextState);
    const nextDistricts = getLocationsByState(nextState);
    const first = nextDistricts[0];
    if (first) {
      setSelectedLocationId(first.id);
      setSelectedTaluk(first.taluks[0] || '');
      setSelectedMandi(first.mandis[0] || '');
    }
  };

  const handleDistrictChange = (nextLocId: string) => {
    setSelectedLocationId(nextLocId);
    const found = ALL_INDIA_LOCATIONS.find((l) => l.id === nextLocId);
    if (found) {
      setSelectedTaluk(found.taluks[0] || '');
      setSelectedMandi(found.mandis[0] || '');
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Location detection is not supported in this browser. Please select manually.');
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const {latitude, longitude} = pos.coords;
        let nearest = ALL_INDIA_LOCATIONS[0];
        let minDist = Infinity;
        for (const loc of ALL_INDIA_LOCATIONS) {
          const dist = haversineKm(latitude, longitude, loc.lat, loc.lng);
          if (dist < minDist) {
            minDist = dist;
            nearest = loc;
          }
        }
        setSelectedState(nearest.state);
        setSelectedLocationId(nearest.id);
        setSelectedTaluk(nearest.taluks[0] || '');
        setSelectedMandi(nearest.mandis[0] || '');
        setLocating(false);
      },
      () => {
        setError('Unable to read GPS location. Please choose your state and district below.');
        setLocating(false);
      },
      {timeout: 7000},
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onComplete({
        state: activeLoc.state,
        district: activeLoc.district,
        taluk: selectedTaluk || activeLoc.taluks[0] || activeLoc.district,
        preferredMandi: selectedMandi || activeLoc.mandis[0] || '',
        selectedLocationId: activeLoc.id,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to save your farm location. Please retry.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#202820] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl bg-white border border-[#E2E6DC] rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-[#050705] p-1 flex items-center justify-center shrink-0">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="KRISHI-MITHRA"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#245C3A]">
              Step 1 of 1 · Farm Location Setup
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-[#202820] tracking-tight">
              Where do you farm, {farmerName}?
            </h1>
          </div>
        </div>

        <p className="text-sm text-[#5B675B] mb-5 leading-relaxed">
          Your location powers live local weather forecasts, rainfall warnings, nearby APMC mandi
          comparisons, and personalized morning voice briefings. You can change this anytime.
        </p>

        <div className="mb-5">
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={locating}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#D4DCD0] bg-[#F7F8F4] hover:bg-[#EAF3E8] hover:border-[#245C3A]/40 text-xs font-semibold text-[#245C3A] transition-colors cursor-pointer"
          >
            {locating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Compass className="w-4 h-4" />
            )}
            <span>{locating ? 'Detecting nearest district...' : 'Auto-detect nearest district'}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="onboard-state"
                className="block text-xs font-semibold text-[#3C483C] mb-1.5"
              >
                State
              </label>
              <select
                id="onboard-state"
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DCD0] bg-[#F7F8F4] text-sm font-medium text-[#202820] focus:outline-none focus:border-[#245C3A] focus:bg-white"
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
                htmlFor="onboard-district"
                className="block text-xs font-semibold text-[#3C483C] mb-1.5"
              >
                District
              </label>
              <select
                id="onboard-district"
                value={activeLoc.id}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DCD0] bg-[#F7F8F4] text-sm font-medium text-[#202820] focus:outline-none focus:border-[#245C3A] focus:bg-white"
              >
                {districtsInState.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.district}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="onboard-taluk"
                className="block text-xs font-semibold text-[#3C483C] mb-1.5"
              >
                Taluk / Locality
              </label>
              <select
                id="onboard-taluk"
                value={selectedTaluk}
                onChange={(e) => setSelectedTaluk(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DCD0] bg-[#F7F8F4] text-sm font-medium text-[#202820] focus:outline-none focus:border-[#245C3A] focus:bg-white"
              >
                {activeLoc.taluks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="onboard-mandi"
                className="block text-xs font-semibold text-[#3C483C] mb-1.5"
              >
                Preferred Nearby Mandi
              </label>
              <select
                id="onboard-mandi"
                value={selectedMandi}
                onChange={(e) => setSelectedMandi(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DCD0] bg-[#F7F8F4] text-sm font-medium text-[#202820] focus:outline-none focus:border-[#245C3A] focus:bg-white"
              >
                {activeLoc.mandis.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F4F7F1] border border-[#E2E8DC] px-4 py-3 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#245C3A] shrink-0" />
            <p className="text-xs text-[#3C483C]">
              Selected:{' '}
              <span className="font-semibold text-[#202820]">
                {selectedTaluk}, {activeLoc.district}, {activeLoc.state}
              </span>{' '}
              · Primary Mandi:{' '}
              <span className="font-semibold text-[#202820]">{selectedMandi}</span>
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FDF2F2] border border-[#F3C6C2] text-xs text-[#9E2B25]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#245C3A] hover:bg-[#1D4B2F] disabled:opacity-60 text-white font-semibold text-sm sm:text-base transition-colors cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving your farm location...</span>
              </>
            ) : (
              <>
                <span>Save Location & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
