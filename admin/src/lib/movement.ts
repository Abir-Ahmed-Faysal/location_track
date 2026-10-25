import type { LocationEvent } from '../api/types';

export type Movement = 'Moving' | 'Stationary' | 'Unknown';
const MAX_ACCURACY_METERS = 50;
const MIN_STATIONARY_MS = 5 * 60_000;
const MAX_CURRENT_FIX_AGE_MS = 60_000;
const STATIONARY_RADIUS_METERS = 30;

/** A single zero-speed fix is never enough evidence to label a device stationary. */
export function classifyMovement(events: LocationEvent[], now = Date.now()): Movement {
  const valid = events.filter((event) => {
    const time = Date.parse(event.capturedAt);
    return Number.isFinite(event.latitude) && event.latitude >= -90 && event.latitude <= 90 &&
      Number.isFinite(event.longitude) && event.longitude >= -180 && event.longitude <= 180 &&
      Number.isFinite(time) && time <= now &&
      (event.accuracyM == null || (event.accuracyM >= 0 && event.accuracyM <= MAX_ACCURACY_METERS));
  }).sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));

  const latest = valid.at(-1);
  if (!latest || now - Date.parse(latest.capturedAt) > MAX_CURRENT_FIX_AGE_MS) return 'Unknown';
  if (latest?.speedMps != null && Number.isFinite(latest.speedMps) && latest.speedMps > 0.8) return 'Moving';
  const reliable = valid.filter((event) => event.accuracyM != null && event.accuracyM <= MAX_ACCURACY_METERS);
  if (reliable.length < 2) return 'Unknown';

  const first = reliable[0];
  const reliableLatest = reliable.at(-1)!;
  const elapsed = Date.parse(reliableLatest.capturedAt) - Date.parse(first.capturedAt);
  if (elapsed < MIN_STATIONARY_MS) return 'Unknown';
  const displacement = haversine(first.latitude, first.longitude, reliableLatest.latitude, reliableLatest.longitude);
  const accuracyAllowance = first.accuracyM! + reliableLatest.accuracyM!;
  return displacement <= Math.min(STATIONARY_RADIUS_METERS, accuracyAllowance || STATIONARY_RADIUS_METERS) ? 'Stationary' : 'Moving';
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hasValidCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}
