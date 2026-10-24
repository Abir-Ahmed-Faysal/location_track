import {
  FreshnessStatus,
  classifyFreshness,
  calculateAgeSeconds,
  DEFAULT_FRESHNESS_CONFIG,
} from './freshness';

describe('Freshness Classification', () => {
  const baseTime = new Date('2026-10-25T12:00:00Z');

  describe('classifyFreshness', () => {
    it('should classify as FRESH when age ≤ 15 seconds', () => {
      const capturedAt = new Date(baseTime.getTime() - 15_000); // exactly 15s ago
      expect(classifyFreshness(capturedAt, baseTime)).toBe(
        FreshnessStatus.FRESH,
      );
    });

    it('should classify as FRESH when age is 0 seconds', () => {
      expect(classifyFreshness(baseTime, baseTime)).toBe(FreshnessStatus.FRESH);
    });

    it('should classify as FRESH when age is 5 seconds', () => {
      const capturedAt = new Date(baseTime.getTime() - 5_000);
      expect(classifyFreshness(capturedAt, baseTime)).toBe(
        FreshnessStatus.FRESH,
      );
    });

    it('should classify as DELAYED when age is 16 seconds', () => {
      const capturedAt = new Date(baseTime.getTime() - 16_000);
      expect(classifyFreshness(capturedAt, baseTime)).toBe(
        FreshnessStatus.DELAYED,
      );
    });

    it('should classify as DELAYED when age is exactly 60 seconds', () => {
      const capturedAt = new Date(baseTime.getTime() - 60_000);
      expect(classifyFreshness(capturedAt, baseTime)).toBe(
        FreshnessStatus.DELAYED,
      );
    });

    it('should classify as STALE when age > 60 seconds', () => {
      const capturedAt = new Date(baseTime.getTime() - 61_000);
      expect(classifyFreshness(capturedAt, baseTime)).toBe(
        FreshnessStatus.STALE,
      );
    });

    it('should classify as STALE when age is very large', () => {
      const capturedAt = new Date(baseTime.getTime() - 3600_000); // 1 hour ago
      expect(classifyFreshness(capturedAt, baseTime)).toBe(
        FreshnessStatus.STALE,
      );
    });

    it('should classify as UNKNOWN when capturedAt is null', () => {
      expect(classifyFreshness(null, baseTime)).toBe(FreshnessStatus.UNKNOWN);
    });

    it('should classify as UNKNOWN when capturedAt is undefined', () => {
      expect(classifyFreshness(undefined, baseTime)).toBe(
        FreshnessStatus.UNKNOWN,
      );
    });

    it('should classify as UNKNOWN when capturedAt is invalid date', () => {
      expect(classifyFreshness(new Date('invalid'), baseTime)).toBe(
        FreshnessStatus.UNKNOWN,
      );
    });

    it('should classify as UNKNOWN when capturedAt is in the future (clock skew)', () => {
      const futureTime = new Date(baseTime.getTime() + 10_000); // 10s in the future
      expect(classifyFreshness(futureTime, baseTime)).toBe(
        FreshnessStatus.UNKNOWN,
      );
    });
  });

  describe('custom thresholds', () => {
    const customConfig = {
      freshThresholdSeconds: 5,
      delayedThresholdSeconds: 30,
    };

    it('should classify as FRESH when age ≤ custom threshold (5s)', () => {
      const capturedAt = new Date(baseTime.getTime() - 5_000);
      expect(classifyFreshness(capturedAt, baseTime, customConfig)).toBe(
        FreshnessStatus.FRESH,
      );
    });

    it('should classify as DELAYED at 6s with custom 5s threshold', () => {
      const capturedAt = new Date(baseTime.getTime() - 6_000);
      expect(classifyFreshness(capturedAt, baseTime, customConfig)).toBe(
        FreshnessStatus.DELAYED,
      );
    });

    it('should classify as STALE at 31s with custom 30s delayed threshold', () => {
      const capturedAt = new Date(baseTime.getTime() - 31_000);
      expect(classifyFreshness(capturedAt, baseTime, customConfig)).toBe(
        FreshnessStatus.STALE,
      );
    });
  });

  describe('calculateAgeSeconds', () => {
    it('should return 0 for same time', () => {
      expect(calculateAgeSeconds(baseTime, baseTime)).toBe(0);
    });

    it('should return positive seconds for past events', () => {
      const capturedAt = new Date(baseTime.getTime() - 30_000);
      expect(calculateAgeSeconds(capturedAt, baseTime)).toBe(30);
    });

    it('should return negative seconds for future events', () => {
      const capturedAt = new Date(baseTime.getTime() + 10_000);
      expect(calculateAgeSeconds(capturedAt, baseTime)).toBe(-10);
    });

    it('should return null for null capturedAt', () => {
      expect(calculateAgeSeconds(null, baseTime)).toBeNull();
    });

    it('should return null for invalid date', () => {
      expect(calculateAgeSeconds(new Date('invalid'), baseTime)).toBeNull();
    });
  });

  describe('default config values', () => {
    it('should have fresh threshold of 15 seconds', () => {
      expect(DEFAULT_FRESHNESS_CONFIG.freshThresholdSeconds).toBe(15);
    });

    it('should have delayed threshold of 60 seconds', () => {
      expect(DEFAULT_FRESHNESS_CONFIG.delayedThresholdSeconds).toBe(60);
    });
  });
});
