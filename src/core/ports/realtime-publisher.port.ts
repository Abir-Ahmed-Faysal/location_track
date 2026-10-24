import type { PersistedLocationEvent } from '../domain/location-event.js';

/**
 * Port interface for realtime event publishing.
 *
 * PRD §6.6:
 * - Keep realtime fan-out separate from the critical persistence path
 *   so a slow client cannot block ingestion.
 * - Authorize each subscription against the relevant device/project/namespace ownership.
 * - Document reconnection behavior.
 */
export interface RealtimePublisher {
  /**
   * Publish a location event to authorized subscribers.
   * This must be non-blocking — a slow subscriber must NOT delay ingestion.
   *
   * @param event - The persisted event to publish
   */
  publish(event: PersistedLocationEvent): Promise<void>;

  /**
   * Publish multiple events (e.g., after a batch ingest).
   *
   * @param events - The persisted events to publish
   */
  publishBatch(events: PersistedLocationEvent[]): Promise<void>;
}

/** Injection token for the RealtimePublisher port */
export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');
