/**
 * Thrown when a duplicate event_id is detected and the caller
 * needs to be explicitly informed (not used for silent dedup in batch).
 */
export class DuplicateEventError extends Error {
  public readonly code = 'DUPLICATE_EVENT' as const;
  public readonly eventId: string;

  constructor(eventId: string) {
    super(`Event ${eventId} has already been accepted`);
    this.name = 'DuplicateEventError';
    this.eventId = eventId;
  }
}
