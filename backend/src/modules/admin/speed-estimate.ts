const MAX_INTERVAL_SECONDS = 5 * 60;
const MAX_REASONABLE_SPEED_MPS = 70;
const MAX_ACCURACY_METERS = 100;
const EARTH_RADIUS_METERS = 6_371_000;

type SpeedPoint = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  capturedAt: Date;
};

/** Estimates speed only from two recent, plausible location fixes. */
export function estimateSpeedMps(latest: SpeedPoint, previous: SpeedPoint | undefined): number | null {
  if (!previous) return null;
  const elapsedSeconds = (latest.capturedAt.getTime() - previous.capturedAt.getTime()) / 1000;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0 || elapsedSeconds > MAX_INTERVAL_SECONDS) return null;
  if ((latest.accuracyM != null && latest.accuracyM > MAX_ACCURACY_METERS) || (previous.accuracyM != null && previous.accuracyM > MAX_ACCURACY_METERS)) return null;
  if (![latest.latitude, latest.longitude, previous.latitude, previous.longitude].every(Number.isFinite)) return null;

  const distance = haversineMeters(previous.latitude, previous.longitude, latest.latitude, latest.longitude);
  const speed = distance / elapsedSeconds;
  return Number.isFinite(speed) && speed <= MAX_REASONABLE_SPEED_MPS ? speed : null;
}

function haversineMeters(latitude1: number, longitude1: number, latitude2: number, longitude2: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = radians(latitude2 - latitude1);
  const deltaLongitude = radians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
