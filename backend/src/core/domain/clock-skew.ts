/**
 * Clock-skew detection and policy.
 *
 * PRD §6.2: Define handling for clock skew.
 * PRD §9: Where device/server clock skew makes age uncertain,
 * expose that uncertainty rather than inventing precision.
 */

/**
 * Configuration for clock-skew tolerance.
 */
export interface ClockSkewConfig {
  /** Maximum allowed future offset in seconds (device ahead of server) */
  maxFutureOffsetSeconds: number;

  /** Maximum allowed past offset in seconds (event too old to be plausible) */
  maxPastOffsetSeconds: number;
}

/** Default clock-skew config — generous defaults for mobile devices */
export const DEFAULT_CLOCK_SKEW_CONFIG: ClockSkewConfig = {
  maxFutureOffsetSeconds: 60, // Allow device clock up to 1 minute ahead
  maxPastOffsetSeconds: 86400, // Allow events up to 24 hours old (offline sync)
};

/**
 * Result of clock-skew analysis.
 */
export enum ClockSkewStatus {
  /** Timestamp is within acceptable range */
  OK = 'OK',

  /** Timestamp is in the future beyond tolerance — possible clock skew */
  FUTURE_SKEW = 'FUTURE_SKEW',

  /** Timestamp is extremely old — possible clock skew or very late sync */
  PAST_SKEW = 'PAST_SKEW',
}

/**
 * Detailed clock-skew analysis result.
 */
export interface ClockSkewAnalysis {
  /** Overall status */
  readonly status: ClockSkewStatus;

  /** Offset in seconds (positive = event is in the future, negative = in the past) */
  readonly offsetSeconds: number;

  /** Whether the event should still be accepted despite skew */
  readonly shouldAccept: boolean;

  /** Human-readable message about the skew */
  readonly message: string | null;
}

/**
 * Analyze the clock skew between a device-reported timestamp and the server's current time.
 *
 * @param capturedAt - The device-reported capture timestamp
 * @param serverNow - The server's current time
 * @param config - Clock-skew tolerance configuration
 * @returns ClockSkewAnalysis with status and recommendation
 */
export function analyzeClockSkew(
  capturedAt: Date,
  serverNow: Date = new Date(),
  config: ClockSkewConfig = DEFAULT_CLOCK_SKEW_CONFIG,
): ClockSkewAnalysis {
  const offsetSeconds = (capturedAt.getTime() - serverNow.getTime()) / 1000;

  // Event is in the future (device clock ahead)
  if (offsetSeconds > config.maxFutureOffsetSeconds) {
    return {
      status: ClockSkewStatus.FUTURE_SKEW,
      offsetSeconds,
      shouldAccept: false,
      message: `Event timestamp is ${Math.round(offsetSeconds)}s in the future (max allowed: ${config.maxFutureOffsetSeconds}s)`,
    };
  }

  // Event is extremely old (device clock behind or very late offline sync)
  const ageSeconds = -offsetSeconds;
  if (ageSeconds > config.maxPastOffsetSeconds) {
    return {
      status: ClockSkewStatus.PAST_SKEW,
      offsetSeconds,
      shouldAccept: false,
      message: `Event is ${Math.round(ageSeconds)}s old (max allowed: ${config.maxPastOffsetSeconds}s)`,
    };
  }

  return {
    status: ClockSkewStatus.OK,
    offsetSeconds,
    shouldAccept: true,
    message: null,
  };
}
