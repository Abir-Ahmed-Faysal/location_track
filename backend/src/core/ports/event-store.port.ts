import type {
  LocationEventInput,
  PersistedLocationEvent,
} from '../domain/location-event.js';

/**
 * Port interface for persisting and querying location events.
 *
 * Implementations must:
 * - Ensure unique(event_id) constraint
 * - Store PostGIS geography for spatial queries
 * - Return persisted events with server-generated received_at
 * - Support efficient device+time range queries
 */
export interface EventStore {
  /**
   * Persist a batch of location events atomically.
   * Events with existing event_ids are classified as duplicates (not errors).
   *
   * @param events - Validated event inputs to persist
   * @returns Object with arrays of accepted event_ids and duplicate event_ids
   */
  persistBatch(
    events: LocationEventInput[],
  ): Promise<{ accepted: string[]; duplicates: string[] }>;

  /**
   * Check which event_ids from a list already exist.
   *
   * @param eventIds - Event IDs to check
   * @returns Set of event_ids that already exist in the store
   */
  findExistingEventIds(eventIds: string[]): Promise<Set<string>>;

  /**
   * Query location events by device and time range.
   *
   * @param query - Device ID, time range, and pagination parameters
   * @returns Paginated list of persisted events
   */
  queryHistory(query: HistoryQuery): Promise<PaginatedEvents>;

  /**
   * Get a single event by its event_id.
   */
  findByEventId(eventId: string): Promise<PersistedLocationEvent | null>;
}

/**
 * Query parameters for location history.
 */
export interface HistoryQuery {
  readonly deviceId: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit: number;
  readonly cursor?: string | null;
}

/**
 * Paginated result for event queries.
 */
export interface PaginatedEvents {
  readonly items: PersistedLocationEvent[];
  readonly nextCursor: string | null;
}

/** Injection token for the EventStore port */
export const EVENT_STORE = Symbol('EVENT_STORE');
