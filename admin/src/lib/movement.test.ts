import { describe, expect, it } from 'vitest';
import { classifyMovement, hasValidCoordinates } from './movement';
import type { LocationEvent } from '../api/types';

const now = Date.parse('2026-10-25T00:10:00Z');
const event = (minutesAgo: number, latitude = 23.78, speedMps: number | null = 0): LocationEvent => ({
  id: String(minutesAgo), eventId: String(minutesAgo), deviceId: 'device-1', latitude, longitude: 90.4,
  accuracyM: 8, altitudeM: null, speedMps, bearingDeg: null, provider: 'gps',
  capturedAt: new Date(now - minutesAgo * 60_000).toISOString(), receivedAt: new Date(now - minutesAgo * 60_000).toISOString(),
});

describe('movement classification', () => {
  it('does not call one zero-speed fix stationary', () => expect(classifyMovement([event(0)], now)).toBe('Unknown'));
  it('requires several minutes of accurate fixes before stationary', () => expect(classifyMovement([event(6), event(0)], now)).toBe('Stationary'));
  it('recognizes positive device speed as moving', () => expect(classifyMovement([event(0, 23.78, 1.2)], now)).toBe('Moving'));
  it('keeps movement unknown when fixes have no accuracy estimate', () => {
    const first = { ...event(6), accuracyM: null };
    const last = { ...event(0), accuracyM: null };
    expect(classifyMovement([first, last], now)).toBe('Unknown');
  });
  it('keeps stale location history from implying current movement', () => expect(classifyMovement([event(6), event(2)], now)).toBe('Unknown'));
  it('rejects invalid coordinates', () => expect(hasValidCoordinates(91, 90)).toBe(false));
});
