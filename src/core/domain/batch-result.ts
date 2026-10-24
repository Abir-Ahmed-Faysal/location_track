/**
 * Batch ingestion result type.
 *
 * PRD §6.4: Return a clear acknowledgement identifying accepted, duplicate,
 * and rejected events.
 */
export interface BatchResult {
  /** Event IDs that were newly accepted and durably persisted */
  readonly accepted: string[];

  /** Event IDs that were previously accepted (safe retry — no duplicate rows) */
  readonly duplicates: string[];

  /** Events rejected with per-event reasons */
  readonly rejected: RejectedEvent[];

  /** Server time at the moment the batch was processed (UTC ISO8601) */
  readonly serverTime: Date;
}

/**
 * A single rejected event with the reason for rejection.
 */
export interface RejectedEvent {
  /** The event_id that was rejected, or the index if event_id is itself invalid */
  readonly eventId: string | null;

  /** Index within the batch (0-based) */
  readonly index: number;

  /** Human-readable rejection reason */
  readonly reason: string;
}

/**
 * Create an empty batch result with the current server time.
 */
export function createEmptyBatchResult(
  serverTime: Date = new Date(),
): BatchResult {
  return {
    accepted: [],
    duplicates: [],
    rejected: [],
    serverTime,
  };
}

/**
 * Create a fully-accepted batch result.
 */
export function createAcceptedBatchResult(
  eventIds: string[],
  serverTime: Date = new Date(),
): BatchResult {
  return {
    accepted: [...eventIds],
    duplicates: [],
    rejected: [],
    serverTime,
  };
}

/**
 * Merge accepted, duplicate, and rejected classifications into a BatchResult.
 */
export function buildBatchResult(params: {
  accepted: string[];
  duplicates: string[];
  rejected: RejectedEvent[];
  serverTime: Date;
}): BatchResult {
  return {
    accepted: [...params.accepted],
    duplicates: [...params.duplicates],
    rejected: [...params.rejected],
    serverTime: params.serverTime,
  };
}
