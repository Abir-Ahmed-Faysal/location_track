/**
 * Idempotency contract for location event ingestion.
 *
 * PRD §6.3: Use stable event IDs and idempotent server processing.
 * PRD §6.4: Make retries safe using idempotency keys and database constraints.
 *
 * The delivery model is at-least-once delivery with idempotent effects.
 * Exactly-once network delivery must not be claimed.
 */

/**
 * Result of checking an event_id against existing records.
 */
export enum IdempotencyOutcome {
  /** Event is new — not seen before */
  NEW = 'NEW',

  /** Event was previously accepted — this is a safe retry */
  DUPLICATE = 'DUPLICATE',
}

/**
 * Check if an event_id has already been processed.
 *
 * @param eventId - The event ID to check
 * @param existingIds - Set of previously accepted event IDs
 * @returns IdempotencyOutcome indicating if this is new or duplicate
 */
export function checkIdempotency(
  eventId: string,
  existingIds: Set<string>,
): IdempotencyOutcome {
  if (existingIds.has(eventId)) {
    return IdempotencyOutcome.DUPLICATE;
  }
  return IdempotencyOutcome.NEW;
}

/**
 * Classify a batch of event IDs against existing records.
 *
 * @param eventIds - Array of event IDs from the incoming batch
 * @param existingIds - Set of previously accepted event IDs
 * @returns Object with arrays of new and duplicate event IDs
 */
export function classifyBatchIdempotency(
  eventIds: string[],
  existingIds: Set<string>,
): { newIds: string[]; duplicateIds: string[] } {
  const newIds: string[] = [];
  const duplicateIds: string[] = [];

  for (const id of eventIds) {
    if (existingIds.has(id)) {
      duplicateIds.push(id);
    } else {
      newIds.push(id);
    }
  }

  return { newIds, duplicateIds };
}
