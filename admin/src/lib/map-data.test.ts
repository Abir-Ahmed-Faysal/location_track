import { describe, expect, it } from 'vitest';
import { devicesWithValidLocations } from './map-data';
import type { AdminDevice } from '../api/types';

function device(id: string, latitude: number | null, longitude = 90): AdminDevice {
  return {
    id, platform: 'ANDROID', status: 'ACTIVE', createdAt: '2026-10-25T00:00:00Z', lastSeenAt: null, owner: null,
    latestLocation: latitude == null ? null : {
      eventId: id, latitude, longitude, accuracyM: 5, capturedAt: '2026-10-25T00:00:00Z', receivedAt: '2026-10-25T00:00:00Z',
      altitudeM: null, speedMps: null, bearingDeg: null, freshnessStatus: 'FRESH', accuracyClassification: 'GOOD',
    },
  };
}

describe('map data', () => {
  it('keeps only devices with valid saved coordinates', () => {
    expect(devicesWithValidLocations([device('valid', 23.8), device('missing', null), device('invalid-lat', 91), device('invalid-lng', 0, 181)]).map((item) => item.id)).toEqual(['valid']);
  });
});
