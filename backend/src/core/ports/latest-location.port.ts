import type { PersistedLocationEvent } from '../domain/location-event.js';
import type { FreshnessStatus } from '../domain/freshness.js';
import type { AccuracyClassification } from '../domain/accuracy.js';

/**
 * Port interface for the latest-location read model.
 *
 * PRD §6.5:
 * - Maintain an efficient latest-location read path that does not scan full history
 * - Update the latest-location record only when the incoming event is newer
 * - Use transactions to keep persistence and latest-location state consistent
 *
 * PRD §13.2:
 * - Historical replay must NOT overwrite a newer latest location
 */
export interface LatestLocationStore {
  /**
   * Get the latest known location for a device.
   *
   * @param deviceId - The device to query
   * @returns The latest location with freshness/accuracy metadata, or null
   */
  getLatest(deviceId: string): Promise<LatestLocation | null>;

  /**
   * Conditionally update the latest location for a device.
   * Only updates if the incoming event is newer than the current latest
   * (based on the event ordering policy).
   *
   * @param deviceId - The device to update
   * @param event - The candidate event
   * @returns true if the latest was updated, false if a newer event already exists
   */
  updateIfNewer(
    deviceId: string,
    event: PersistedLocationEvent,
  ): Promise<boolean>;

  /**
   * Get the latest locations for multiple devices.
   *
   * @param deviceIds - Device IDs to query
   * @returns Map of deviceId → LatestLocation
   */
  getLatestBulk(deviceIds: string[]): Promise<Map<string, LatestLocation>>;
}

/**
 * Latest location with enriched metadata.
 */
export interface LatestLocation {
  readonly deviceId: string;
  readonly eventId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyM: number | null;
  readonly capturedAt: Date;
  readonly receivedAt: Date;
  readonly freshnessStatus: FreshnessStatus;
  readonly accuracyClassification: AccuracyClassification;
}

/** Injection token for the LatestLocationStore port */
export const LATEST_LOCATION_STORE = Symbol('LATEST_LOCATION_STORE');
