/**
 * Structured validation error for the location engine.
 *
 * PRD §6.4: Return a clear acknowledgement with per-field error details.
 * Never return stack traces or secrets.
 */
export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR' as const;
  public readonly details: ValidationDetail[];

  constructor(message: string, details: ValidationDetail[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * A single field-level validation failure.
 */
export interface ValidationDetail {
  /** The field path that failed validation (e.g., 'events.0.latitude') */
  readonly field: string;

  /** Human-readable reason for the failure */
  readonly reason: string;
}
