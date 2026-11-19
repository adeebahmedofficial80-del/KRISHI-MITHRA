import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import {MapPin} from 'lucide-react';
import {useEffect, useState} from 'react';
import {KARNATAKA_MARKETS} from '../data/locations';
import {fetchMapsApiKey} from '../services/aiClient';
import {LocationOption, MarketPriceEntry} from '../types/krishi';

interface MandiMarkerProps {
  entry: MarketPriceEntry;
  lat: number;
  lng: number;
  isSelected: boolean;
  isHighest: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function MandiMarker({
  entry,
  lat,
  lng,
  isSelected,
  isHighest,
  onSelect,
  onClose,
}: MandiMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{lat, lng}}
        title={`${entry.marketName} · ₹${entry.modalPrice}/kg`}
        onClick={onSelect}
      >
        <Pin
          background={isHighest ? '#245C3A' : '#3F7D46'}
          borderColor="#FFFFFF"
          glyphColor="#FFFFFF"
        />
      </AdvancedMarker>
      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose}>
          <div className="p-1 min-w-[170px] text-[#202820]">
            <p className="font-semibold text-sm">{entry.marketName}</p>
            <p className="text-xs text-[#6B756A]">{entry.district}</p>
            <p className="mt-1.5 font-mono text-base font-bold text-[#245C3A] tabular-nums">
              ₹{entry.modalPrice}/kg
            </p>
            <p className="text-[11px] text-[#6B756A] tabular-nums">
              Range ₹{entry.minPrice}–₹{entry.maxPrice}/kg
            </p>
            <p className="text-[11px] text-[#6B756A] mt-0.5 tabular-nums">
              {entry.distanceKm ? `~${entry.distanceKm} km away · ` : ''}
              {entry.arrivalDate}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface MandiMapProps {
  cropName: string;
  entries: MarketPriceEntry[];
  highestMarketId: string;
  location: LocationOption;
}

export function MandiMap({cropName, entries, highestMarketId, location}: MandiMapProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchMapsApiKey().then((key) => {
      if (active) {
        setApiKey(key);
        setLoaded(true);
      }
    });
    const onQuota = () => setQuotaBlocked(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => {
      active = false;
      window.removeEventListener('gmp-quota-exceeded', onQuota);
    };
  }, []);

  if (!loaded) {
    return (
      <div className="h-80 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] flex items-center justify-center text-sm text-[#6B756A]">
        Loading interactive mandi map...
      </div>
    );
  }

  if (!apiKey || quotaBlocked) {
    return (
      <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#202820]">
          <MapPin className="w-4 h-4 text-[#245C3A]" />
          <span>Nearby Karnataka APMC Mandis for {cropName}</span>
        </div>
        <p className="mt-1 text-xs text-[#6B756A]">
          {quotaBlocked
            ? 'Interactive map tiles paused due to daily quota limit. Coordinates and listed rates remain available below.'
            : 'Map preview is showing listed APMC coordinates around your selected district.'}
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {entries.map((entry) => {
            const center = KARNATAKA_MARKETS.find((m) => m.id === entry.marketId);
            return (
              <div
                key={entry.marketId}
                className="bg-white border border-[#E4E9E0] rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-[#202820]">{entry.marketName}</p>
                  <p className="text-xs text-[#6B756A] tabular-nums">
                    {entry.distanceKm ? `~${entry.distanceKm} km` : entry.district}
                    {center ? ` · ${center.lat.toFixed(2)}°N` : ''}
                  </p>
                </div>
                <span className="font-mono font-bold text-sm text-[#245C3A] tabular-nums">
                  ₹{entry.modalPrice}/kg
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[#E4E9E0] bg-white">
      <div className="px-4 py-2.5 bg-[#FAF9F4] border-b border-[#E4E9E0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B756A]">
        <span>
          Showing {entries.length} Karnataka APMC mandis for <strong className="text-[#202820]">{cropName}</strong> near{' '}
          <strong className="text-[#202820]">{location.name}</strong>
        </span>
        <span>Tap any pin to inspect mandi modal price & distance</span>
      </div>
      <div className="h-80 sm:h-96 w-full">
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            defaultCenter={{lat: location.lat, lng: location.lng}}
            defaultZoom={9}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            gestureHandling="cooperative"
            style={{width: '100%', height: '100%'}}
          >
            <AdvancedMarker
              position={{lat: location.lat, lng: location.lng}}
              title={`Selected Area: ${location.name}`}
            >
              <Pin background="#5A91C8" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
            </AdvancedMarker>

            {entries.map((entry) => {
              const center = KARNATAKA_MARKETS.find((m) => m.id === entry.marketId);
              if (!center) return null;
              return (
                <MandiMarker
                  key={entry.marketId}
                  entry={entry}
                  lat={center.lat}
                  lng={center.lng}
                  isSelected={selectedMarketId === entry.marketId}
                  isHighest={entry.marketId === highestMarketId}
                  onSelect={() => setSelectedMarketId(entry.marketId)}
                  onClose={() => setSelectedMarketId(null)}
                />
              );
            })}
          </GoogleMap>
        </APIProvider>
      </div>
    </div>
  );
}
