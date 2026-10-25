import {
  ClockSkewStatus,
  analyzeClockSkew,
  DEFAULT_CLOCK_SKEW_CONFIG,
} from './clock-skew';

describe('Clock Skew Detection', () => {
  const serverNow = new Date('2026-10-25T12:00:00Z');

  describe('analyzeClockSkew', () => {
    it('should return OK for a timestamp at server time', () => {
      const result = analyzeClockSkew(serverNow, serverNow);
      expect(result.status).toBe(ClockSkewStatus.OK);
      expect(result.shouldAccept).toBe(true);
      expect(result.offsetSeconds).toBe(0);
    });

    it('should return OK for a timestamp 30 seconds in the past', () => {
      const capturedAt = new Date(serverNow.getTime() - 30_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.OK);
      expect(result.shouldAccept).toBe(true);
    });

    it('should return OK for a timestamp 30 seconds in the future (within tolerance)', () => {
      const capturedAt = new Date(serverNow.getTime() + 30_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.OK);
      expect(result.shouldAccept).toBe(true);
    });

    it('should return OK for a timestamp exactly at the future threshold (60s)', () => {
      const capturedAt = new Date(serverNow.getTime() + 60_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.OK);
      expect(result.shouldAccept).toBe(true);
    });

    it('should return FUTURE_SKEW for a timestamp 61s in the future', () => {
      const capturedAt = new Date(serverNow.getTime() + 61_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.FUTURE_SKEW);
      expect(result.shouldAccept).toBe(false);
      expect(result.message).not.toBeNull();
    });

    it('should return FUTURE_SKEW for a timestamp 5 minutes in the future', () => {
      const capturedAt = new Date(serverNow.getTime() + 300_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.FUTURE_SKEW);
      expect(result.shouldAccept).toBe(false);
    });

    it('should return OK for an event 12 hours old (offline sync)', () => {
      const capturedAt = new Date(serverNow.getTime() - 12 * 3600_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.OK);
      expect(result.shouldAccept).toBe(true);
    });

    it('should return OK for an event exactly at past threshold (24h)', () => {
      const capturedAt = new Date(serverNow.getTime() - 86400_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.OK);
      expect(result.shouldAccept).toBe(true);
    });

    it('should return PAST_SKEW for an event older than 24h', () => {
      const capturedAt = new Date(serverNow.getTime() - 86401_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.PAST_SKEW);
      expect(result.shouldAccept).toBe(false);
      expect(result.message).not.toBeNull();
    });

    it('should return PAST_SKEW for a very old event', () => {
      const capturedAt = new Date(serverNow.getTime() - 7 * 86400_000); // 7 days ago
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.status).toBe(ClockSkewStatus.PAST_SKEW);
      expect(result.shouldAccept).toBe(false);
    });
  });

  describe('custom config', () => {
    const strictConfig = {
      maxFutureOffsetSeconds: 10,
      maxPastOffsetSeconds: 3600, // 1 hour
    };

    it('should use custom future threshold', () => {
      const capturedAt = new Date(serverNow.getTime() + 11_000);
      const result = analyzeClockSkew(capturedAt, serverNow, strictConfig);
      expect(result.status).toBe(ClockSkewStatus.FUTURE_SKEW);
    });

    it('should use custom past threshold', () => {
      const capturedAt = new Date(serverNow.getTime() - 3601_000);
      const result = analyzeClockSkew(capturedAt, serverNow, strictConfig);
      expect(result.status).toBe(ClockSkewStatus.PAST_SKEW);
    });
  });

  describe('offset calculation', () => {
    it('should report positive offset for future timestamps', () => {
      const capturedAt = new Date(serverNow.getTime() + 100_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.offsetSeconds).toBe(100);
    });

    it('should report negative offset for past timestamps', () => {
      const capturedAt = new Date(serverNow.getTime() - 100_000);
      const result = analyzeClockSkew(capturedAt, serverNow);
      expect(result.offsetSeconds).toBe(-100);
    });
  });

  describe('default config', () => {
    it('should allow 60 seconds future offset', () => {
      expect(DEFAULT_CLOCK_SKEW_CONFIG.maxFutureOffsetSeconds).toBe(60);
    });

    it('should allow 24 hours past offset', () => {
      expect(DEFAULT_CLOCK_SKEW_CONFIG.maxPastOffsetSeconds).toBe(86400);
    });
  });
});
