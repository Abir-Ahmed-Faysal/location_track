import { estimateSpeedMps } from './speed-estimate';

const point = (latitude: number, longitude: number, seconds: number) => ({ latitude, longitude, accuracyM: 10, capturedAt: new Date(seconds * 1000) });

describe('estimateSpeedMps', () => {
  it('estimates speed from recent fixes', () => {
    expect(estimateSpeedMps(point(23.78, 90.4, 10), point(23.78, 90.399, 0))).toBeGreaterThan(0);
  });

  it('rejects large gaps and implausible jumps', () => {
    expect(estimateSpeedMps(point(23.78, 90.4, 601), point(23.78, 90.399, 0))).toBeNull();
    expect(estimateSpeedMps(point(23.78, 90.5, 10), point(23.78, 90.399, 0))).toBeNull();
  });
});
