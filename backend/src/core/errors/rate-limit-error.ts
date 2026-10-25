/**
 * Rate limit exceeded error.
 *
 * PRD §6.4: Apply rate limits and return 429 with Retry-After.
 */
export class RateLimitError extends Error {
  public readonly code = 'RATE_LIMIT_EXCEEDED' as const;

  /** Number of seconds the client should wait before retrying */
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
