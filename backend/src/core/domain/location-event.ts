/**
 * Canonical location event — the core data structure for the entire system.
 *
 * This type is used consistently across SDK, API, storage, and realtime messages.
 * Fields match PRD §6.2 exactly.
 */
export interface LocationEvent {
  /** Unique idempotency key generated for the event (UUID v4) */
  readonly eventId: string;

  /** Stable device identity within the integration's ownership model */
  readonly deviceId: string;

  /** Required, range-validated latitude [-90, 90] */
  readonly latitude: number;

  /** Required, range-validated longitude [-180, 180] */
  readonly longitude: number;

  /** Provider-reported horizontal accuracy in metres, if available */
  readonly accuracyM: number | null;

  /** Time the device captured the fix (device clock) */
  readonly capturedAt: Date;

  /** Server-generated time of receipt — null until server processes the event */
  readonly receivedAt: Date | null;

  /** Monotonic sequence or equivalent ordering metadata, if feasible */
  readonly sequence: number | null;

  /** Location provider/source (e.g. 'GPS', 'NETWORK', 'FUSED') */
  readonly provider: string | null;

  /** Optional altitude measurement in metres */
  readonly altitudeM: number | null;

  /** Optional speed measurement in metres per second */
  readonly speedMps: number | null;

  /** Optional bearing/heading in degrees [0, 360) */
  readonly bearingDeg: number | null;

  /** Optional platform/OS version for diagnostics (subject to privacy minimization) */
  readonly platformVersion: string | null;

  /** Optional mock-location risk signal — never definitive fraud proof */
  readonly mockLocationIndicator: boolean | null;
}

/**
 * Raw input for a location event — what comes in from the SDK/API before server processing.
 * Does not include receivedAt (server sets that).
 */
export type LocationEventInput = Omit<LocationEvent, 'receivedAt'>;

/**
 * A persisted location event with server-generated fields guaranteed present.
 */
export interface PersistedLocationEvent extends LocationEvent {
  readonly receivedAt: Date;
}
