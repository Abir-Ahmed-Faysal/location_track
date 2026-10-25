/**
 * Tracking profile definitions per PRD §7.
 *
 * These are starting defaults for outdoor tracking — tunable engineering defaults,
 * not guarantees about Android update cadence or location error.
 *
 * Implementation notes from PRD:
 * - Use Android location priority appropriate to the selected profile
 * - Treat requested intervals as best-effort hints
 * - A distance filter is a request/filtering policy, not a guarantee
 * - Do not batch-delay the freshest location merely to fill a batch
 */

export enum TrackingProfileName {
  /** Active movement and near-live tracking */
  ACTIVE = 'ACTIVE',

  /** Normal movement with battery awareness (recommended default) */
  BALANCED = 'BALANCED',

  /** Low movement or stationary periods */
  STATIONARY = 'STATIONARY',

  /** Integrator-specific requirements */
  CUSTOM = 'CUSTOM',
}

/**
 * A tracking profile configuration.
 */
export interface TrackingProfile {
  /** Profile identifier */
  readonly name: TrackingProfileName;

  /** Desired location update interval in seconds (best-effort hint) */
  readonly intervalSeconds: number;

  /** Minimum distance in metres before a new update is considered (filtering policy) */
  readonly distanceFilterM: number;

  /** Human-readable description of intended use */
  readonly description: string;
}

/**
 * Predefined tracking profiles per PRD §7 table.
 */
export const TRACKING_PROFILES: Record<
  Exclude<TrackingProfileName, TrackingProfileName.CUSTOM>,
  TrackingProfile
> = {
  [TrackingProfileName.ACTIVE]: {
    name: TrackingProfileName.ACTIVE,
    intervalSeconds: 5,
    distanceFilterM: 5,
    description: 'Active movement and near-live tracking',
  },
  [TrackingProfileName.BALANCED]: {
    name: TrackingProfileName.BALANCED,
    intervalSeconds: 10,
    distanceFilterM: 10,
    description: 'Normal movement with battery awareness',
  },
  [TrackingProfileName.STATIONARY]: {
    name: TrackingProfileName.STATIONARY,
    intervalSeconds: 30,
    distanceFilterM: 15,
    description: 'Low movement or stationary periods',
  },
};

/** The recommended default profile per PRD §7 */
export const DEFAULT_TRACKING_PROFILE =
  TRACKING_PROFILES[TrackingProfileName.BALANCED];

/**
 * Create a custom tracking profile with user-specified values.
 */
export function createCustomProfile(
  intervalSeconds: number,
  distanceFilterM: number,
  description = 'Custom tracking profile',
): TrackingProfile {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error('intervalSeconds must be positive');
  }
  if (!Number.isFinite(distanceFilterM) || distanceFilterM < 0) {
    throw new Error('distanceFilterM must be non-negative');
  }

  return {
    name: TrackingProfileName.CUSTOM,
    intervalSeconds,
    distanceFilterM,
    description,
  };
}
