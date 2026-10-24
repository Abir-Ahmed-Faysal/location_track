import type {
  LocationEvent,
  PersistedLocationEvent,
} from './location-event.js';

/**
 * Event ordering policy for latest-location updates.
 *
 * PRD §6.5: Update the latest-location record only when the incoming event
 * is newer according to the documented ordering policy.
 *
 * Primary ordering: captured_at (device capture time).
 * Tiebreaker: sequence number (if available), then eventId for determinism.
 *
 * Historical replay must NOT overwrite a newer latest location (PRD §13.2).
 */

/**
 * Compare two location events to determine ordering.
 *
 * @returns negative if `a` is older, positive if `a` is newer, 0 if equal
 */
export function compareEventOrder(
  a: Pick<LocationEvent, 'capturedAt' | 'sequence' | 'eventId'>,
  b: Pick<LocationEvent, 'capturedAt' | 'sequence' | 'eventId'>,
): number {
  // Primary: compare by captured_at timestamp
  const timeDiff = a.capturedAt.getTime() - b.capturedAt.getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }

  // Secondary: compare by sequence number if both are available
  if (a.sequence !== null && b.sequence !== null) {
    const seqDiff = a.sequence - b.sequence;
    if (seqDiff !== 0) {
      return seqDiff;
    }
  }

  // Tertiary: lexicographic eventId for determinism
  return a.eventId.localeCompare(b.eventId);
}

/**
 * Determine if a new event should replace the current latest location.
 *
 * @param incoming - The newly received event
 * @param current - The current latest location (null if no previous location)
 * @returns true if the incoming event should become the new latest
 */
export function isNewerEvent(
  incoming: Pick<LocationEvent, 'capturedAt' | 'sequence' | 'eventId'>,
  current: Pick<LocationEvent, 'capturedAt' | 'sequence' | 'eventId'> | null,
): boolean {
  if (current === null) {
    return true;
  }

  return compareEventOrder(incoming, current) > 0;
}

/**
 * Represents how an out-of-order or late event should be handled.
 */
export enum LateEventPolicy {
  /** Accept and store the event but do NOT update the latest-location read model */
  ACCEPT_NO_LATEST_UPDATE = 'ACCEPT_NO_LATEST_UPDATE',

  /** Accept and store the event (it is newer, so also update latest) */
  ACCEPT_AND_UPDATE_LATEST = 'ACCEPT_AND_UPDATE_LATEST',

  /** The event is a duplicate and should be reported as such */
  DUPLICATE = 'DUPLICATE',
}

/**
 * Determine how to handle an incoming event relative to the current latest.
 */
export function classifyIncomingEvent(
  incoming: Pick<LocationEvent, 'capturedAt' | 'sequence' | 'eventId'>,
  current: Pick<LocationEvent, 'capturedAt' | 'sequence' | 'eventId'> | null,
  existingEventIds: Set<string>,
): LateEventPolicy {
  if (existingEventIds.has(incoming.eventId)) {
    return LateEventPolicy.DUPLICATE;
  }

  if (isNewerEvent(incoming, current)) {
    return LateEventPolicy.ACCEPT_AND_UPDATE_LATEST;
  }

  return LateEventPolicy.ACCEPT_NO_LATEST_UPDATE;
}
