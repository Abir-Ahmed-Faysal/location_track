/**
 * Accuracy classification based on provider-reported horizontal accuracy.
 *
 * PRD §9: A reported accuracy radius is an estimate, not a guaranteed error bound.
 *
 * Default thresholds (configurable per PRD §9):
 * - Good:    ≤ 25 metres
 * - Reduced: > 25 m and ≤ 50 m
 * - Poor:    > 50 metres
 */
export enum AccuracyClassification {
  /** Reported accuracy ≤ 25 m — good estimated accuracy */
  GOOD = 'GOOD',

  /** Reported accuracy > 25 m and ≤ 50 m — reduced confidence */
  REDUCED = 'REDUCED',

  /** Reported accuracy > 50 m — poor estimated accuracy */
  POOR = 'POOR',

  /** Accuracy not available or not reported by provider */
  UNAVAILABLE = 'UNAVAILABLE',
}

/**
 * Configurable accuracy thresholds in metres.
 */
export interface AccuracyConfig {
  /** Maximum accuracy_m to be classified as GOOD (default: 25) */
  goodThresholdM: number;
  /** Maximum accuracy_m to be classified as REDUCED (default: 50) */
  reducedThresholdM: number;
}

/** Default accuracy thresholds per PRD §9 */
export const DEFAULT_ACCURACY_CONFIG: AccuracyConfig = {
  goodThresholdM: 25,
  reducedThresholdM: 50,
};

/**
 * Classify the estimated accuracy of a location event.
 *
 * @param accuracyM - Provider-reported horizontal accuracy in metres (null if unavailable)
 * @param config - Accuracy thresholds (defaults to PRD §9 values)
 * @returns AccuracyClassification
 */
export function classifyAccuracy(
  accuracyM: number | null | undefined,
  config: AccuracyConfig = DEFAULT_ACCURACY_CONFIG,
): AccuracyClassification {
  if (
    accuracyM === null ||
    accuracyM === undefined ||
    !isFinite(accuracyM) ||
    accuracyM < 0
  ) {
    return AccuracyClassification.UNAVAILABLE;
  }

  if (accuracyM <= config.goodThresholdM) {
    return AccuracyClassification.GOOD;
  }

  if (accuracyM <= config.reducedThresholdM) {
    return AccuracyClassification.REDUCED;
  }

  return AccuracyClassification.POOR;
}
