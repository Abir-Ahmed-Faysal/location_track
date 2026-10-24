import {
  AccuracyClassification,
  classifyAccuracy,
  DEFAULT_ACCURACY_CONFIG,
} from './accuracy';

describe('Accuracy Classification', () => {
  describe('classifyAccuracy', () => {
    it('should classify as GOOD when accuracy ≤ 25m', () => {
      expect(classifyAccuracy(25)).toBe(AccuracyClassification.GOOD);
    });

    it('should classify as GOOD when accuracy is 0m', () => {
      expect(classifyAccuracy(0)).toBe(AccuracyClassification.GOOD);
    });

    it('should classify as GOOD when accuracy is 10m', () => {
      expect(classifyAccuracy(10)).toBe(AccuracyClassification.GOOD);
    });

    it('should classify as REDUCED when accuracy is 26m', () => {
      expect(classifyAccuracy(26)).toBe(AccuracyClassification.REDUCED);
    });

    it('should classify as REDUCED when accuracy is exactly 50m', () => {
      expect(classifyAccuracy(50)).toBe(AccuracyClassification.REDUCED);
    });

    it('should classify as POOR when accuracy is 51m', () => {
      expect(classifyAccuracy(51)).toBe(AccuracyClassification.POOR);
    });

    it('should classify as POOR when accuracy is 200m', () => {
      expect(classifyAccuracy(200)).toBe(AccuracyClassification.POOR);
    });

    it('should classify as UNAVAILABLE when accuracy is null', () => {
      expect(classifyAccuracy(null)).toBe(AccuracyClassification.UNAVAILABLE);
    });

    it('should classify as UNAVAILABLE when accuracy is undefined', () => {
      expect(classifyAccuracy(undefined)).toBe(
        AccuracyClassification.UNAVAILABLE,
      );
    });

    it('should classify as UNAVAILABLE when accuracy is NaN', () => {
      expect(classifyAccuracy(NaN)).toBe(AccuracyClassification.UNAVAILABLE);
    });

    it('should classify as UNAVAILABLE when accuracy is negative', () => {
      expect(classifyAccuracy(-5)).toBe(AccuracyClassification.UNAVAILABLE);
    });

    it('should classify as UNAVAILABLE when accuracy is Infinity', () => {
      expect(classifyAccuracy(Infinity)).toBe(
        AccuracyClassification.UNAVAILABLE,
      );
    });
  });

  describe('custom thresholds', () => {
    const customConfig = {
      goodThresholdM: 10,
      reducedThresholdM: 30,
    };

    it('should classify as GOOD when accuracy ≤ custom 10m threshold', () => {
      expect(classifyAccuracy(10, customConfig)).toBe(
        AccuracyClassification.GOOD,
      );
    });

    it('should classify as REDUCED at 11m with custom 10m good threshold', () => {
      expect(classifyAccuracy(11, customConfig)).toBe(
        AccuracyClassification.REDUCED,
      );
    });

    it('should classify as POOR at 31m with custom 30m reduced threshold', () => {
      expect(classifyAccuracy(31, customConfig)).toBe(
        AccuracyClassification.POOR,
      );
    });
  });

  describe('default config values', () => {
    it('should have good threshold of 25 metres', () => {
      expect(DEFAULT_ACCURACY_CONFIG.goodThresholdM).toBe(25);
    });

    it('should have reduced threshold of 50 metres', () => {
      expect(DEFAULT_ACCURACY_CONFIG.reducedThresholdM).toBe(50);
    });
  });
});
