/**
 * Freshness classification based on how recently a location was captured.
 *
 * PRD §9: Freshness is based on capture time, not just server receipt time.
 * If a location captured 90 seconds ago arrives now, it must NOT be represented as live.
 *
 * Default thresholds (configurable per PRD §9):
 * - Fresh:   ≤ 15 seconds
 * - Delayed: 15–60 seconds
 * - Stale:   > 60 seconds
 */
export enum FreshnessStatus {
  /** Captured within the fresh threshold — suitable for near-live display */
  FRESH = 'FRESH',

  /** Captured recently but beyond the fresh threshold */
  DELAYED = 'DELAYED',

  /** Captured too long ago to be considered current */
  STALE = 'STALE',

  /** Freshness cannot be determined (e.g., missing captured_at or uncertain clock) */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Configurable freshness thresholds in seconds.
 * Store the underlying values so each integrating product can set its own thresholds.
 */
export interface FreshnessConfig {
  /** Maximum age in seconds to be classified as FRESH (default: 15) */
  freshThresholdSeconds: number;
  /** Maximum age in seconds to be classified as DELAYED (default: 60) */
  delayedThresholdSeconds: number;
}

/** Default freshness thresholds per PRD §9 */
export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  freshThresholdSeconds: 15,
  delayedThresholdSeconds: 60,
};

/**
 * Classify the freshness of a location event based on its capture time.
 *
 * @param capturedAt - The device-reported capture timestamp
 * @param now - Current reference time (defaults to Date.now, injectable for testing)
 * @param config - Freshness thresholds (defaults to PRD §9 values)
 * @returns FreshnessStatus classification
 */
export function classifyFreshness(
  capturedAt: Date | null | undefined,
  now: Date = new Date(),
  config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG,
): FreshnessStatus {
  if (!capturedAt || !isFinite(capturedAt.getTime())) {
    return FreshnessStatus.UNKNOWN;
  }

  const ageSeconds = (now.getTime() - capturedAt.getTime()) / 1000;

  // Future timestamps (possible clock skew) are treated as UNKNOWN
  if (ageSeconds < 0) {
    return FreshnessStatus.UNKNOWN;
  }

  if (ageSeconds <= config.freshThresholdSeconds) {
    return FreshnessStatus.FRESH;
  }

  if (ageSeconds <= config.delayedThresholdSeconds) {
    return FreshnessStatus.DELAYED;
  }

  return FreshnessStatus.STALE;
}

/**
 * Calculate the age of a location event in seconds.
 *
 * @returns Age in seconds, or null if capturedAt is invalid
 */
export function calculateAgeSeconds(
  capturedAt: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!capturedAt || !isFinite(capturedAt.getTime())) {
    return null;
  }

  return (now.getTime() - capturedAt.getTime()) / 1000;
}
