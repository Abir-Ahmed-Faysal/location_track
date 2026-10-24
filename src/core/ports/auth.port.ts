/**
 * Port interface for replaceable authentication.
 *
 * PRD §5.2: The core domain must be independent of a particular authentication vendor.
 * PRD §11: Use replaceable authentication and device identity adapters.
 *
 * Each adopting project may connect its own authentication through an adapter.
 */
export interface AuthAdapter {
  /**
   * Validate an incoming request and extract the authenticated context.
   *
   * @param credentials - Raw credentials from the request (e.g., Bearer token, API key)
   * @returns AuthContext if valid, null if invalid/expired
   */
  validateCredentials(
    credentials: AuthCredentials,
  ): Promise<AuthContext | null>;

  /**
   * Check if an authenticated context has a specific permission.
   *
   * @param context - The authenticated context
   * @param permission - The permission to check
   * @returns true if the context has the permission
   */
  hasPermission(context: AuthContext, permission: string): boolean;
}

/**
 * Raw credentials extracted from an incoming HTTP request.
 */
export interface AuthCredentials {
  /** Bearer token from Authorization header */
  readonly bearerToken?: string;

  /** API key from X-API-Key header */
  readonly apiKey?: string;

  /** Device token from X-Device-Token header */
  readonly deviceToken?: string;
}

/**
 * Authenticated context — the identity and permissions of the requester.
 * Passed through the request pipeline after authentication.
 */
export interface AuthContext {
  /** Type of authenticated entity */
  readonly type: 'user' | 'device' | 'service';

  /** Unique identifier of the authenticated entity */
  readonly subjectId: string;

  /** Device ID if the request is from a device */
  readonly deviceId?: string;

  /** Optional namespace/project context for data isolation */
  readonly namespace?: string;

  /** Permissions the authenticated entity has */
  readonly permissions: string[];
}

/** Injection token for the AuthAdapter port */
export const AUTH_ADAPTER = Symbol('AUTH_ADAPTER');
