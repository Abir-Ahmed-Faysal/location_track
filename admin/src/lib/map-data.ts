import type { AdminDevice } from '../api/types';

export function devicesWithValidLocations(devices: AdminDevice[]): AdminDevice[] {
  return devices.filter((device) => {
    const point = device.latestLocation;
    return Boolean(point && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
      Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180);
  });
}
