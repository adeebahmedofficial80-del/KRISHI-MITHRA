import {LocationOption, MarketCenter} from '../types/krishi';

export const KARNATAKA_LOCATIONS: LocationOption[] = [
  {
    id: 'bengaluru-rural',
    name: 'Bengaluru Rural',
    district: 'Bengaluru Rural',
    state: 'Karnataka',
    lat: 13.2846,
    lng: 77.6078,
  },
  {
    id: 'bengaluru-urban',
    name: 'Bengaluru Urban',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    id: 'mysuru',
    name: 'Mysuru',
    district: 'Mysuru',
    state: 'Karnataka',
    lat: 12.2958,
    lng: 76.6394,
  },
  {
    id: 'mandya',
    name: 'Mandya',
    district: 'Mandya',
    state: 'Karnataka',
    lat: 12.5218,
    lng: 76.8951,
  },
  {
    id: 'tumakuru',
    name: 'Tumakuru',
    district: 'Tumakuru',
    state: 'Karnataka',
    lat: 13.3379,
    lng: 77.1173,
  },
  {
    id: 'hassan',
    name: 'Hassan',
    district: 'Hassan',
    state: 'Karnataka',
    lat: 13.0033,
    lng: 76.1004,
  },
  {
    id: 'kolar',
    name: 'Kolar',
    district: 'Kolar',
    state: 'Karnataka',
    lat: 13.1362,
    lng: 78.1291,
  },
];

export const KARNATAKA_MARKETS: MarketCenter[] = [
  {
    id: 'bengaluru-apmc',
    name: 'Bengaluru APMC',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    lat: 13.0258,
    lng: 77.5488,
    distanceFromBengaluruKm: 28,
  },
  {
    id: 'binny-mill',
    name: 'Binny Mill Market',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    lat: 12.9681,
    lng: 77.5612,
    distanceFromBengaluruKm: 34,
  },
  {
    id: 'hoskote-apmc',
    name: 'Hoskote APMC',
    district: 'Bengaluru Rural',
    state: 'Karnataka',
    lat: 13.0715,
    lng: 77.7982,
    distanceFromBengaluruKm: 22,
  },
  {
    id: 'doddaballapur-apmc',
    name: 'Doddaballapur APMC',
    district: 'Bengaluru Rural',
    state: 'Karnataka',
    lat: 13.2957,
    lng: 77.5378,
    distanceFromBengaluruKm: 12,
  },
  {
    id: 'ramanagara-apmc',
    name: 'Ramanagara APMC',
    district: 'Ramanagara',
    state: 'Karnataka',
    lat: 12.715,
    lng: 77.2813,
    distanceFromBengaluruKm: 56,
  },
  {
    id: 'mysuru-apmc',
    name: 'Mysuru APMC',
    district: 'Mysuru',
    state: 'Karnataka',
    lat: 12.3278,
    lng: 76.6476,
    distanceFromBengaluruKm: 145,
  },
];

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
