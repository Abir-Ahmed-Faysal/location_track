/**
 * Authentication or authorization failure.
 *
 * PRD §11: Authorize reads and realtime subscriptions by ownership/context.
 * Use 404 for inaccessible resources — never reveal whether they exist in another context.
 */
export class UnauthorizedError extends Error {
  public readonly code = 'UNAUTHORIZED' as const;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden — authenticated but not authorized for this action.
 */
export class ForbiddenError extends Error {
  public readonly code = 'FORBIDDEN' as const;

  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Resource not found — also used when a resource exists in another
 * context but the current context has no access (to prevent information leakage).
 */
export class NotFoundError extends Error {
  public readonly code = 'NOT_FOUND' as const;

  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} '${id}' not found` : `${resource} not found`;
    super(msg);
    this.name = 'NotFoundError';
  }
}
