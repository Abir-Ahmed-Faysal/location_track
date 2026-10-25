import type {
  DeviceIdentity,
  DeviceRegistrationInput,
} from '../domain/device-identity.js';

/**
 * Port interface for device identity management.
 *
 * PRD §11: Use replaceable device identity adapters.
 * The engine tracks devices without assuming a specific enrollment mechanism.
 */
export interface DeviceIdentityAdapter {
  /**
   * Register a new device.
   *
   * @param input - Device registration details
   * @returns The registered device identity
   */
  register(input: DeviceRegistrationInput): Promise<DeviceIdentity>;

  /**
   * Look up a device by its internal ID.
   *
   * @param deviceId - Internal device UUID
   * @returns Device identity or null if not found/revoked
   */
  findById(deviceId: string): Promise<DeviceIdentity | null>;

  /**
   * Look up a device by its external key.
   *
   * @param externalKey - The key known to the integrating application
   * @returns Device identity or null if not found/revoked
   */
  findByExternalKey(externalKey: string): Promise<DeviceIdentity | null>;

  /**
   * Revoke a device's registration.
   *
   * @param deviceId - Internal device UUID
   * @returns true if the device was revoked, false if not found
   */
  revoke(deviceId: string): Promise<boolean>;

  /**
   * Update the device's last-seen timestamp.
   *
   * @param deviceId - Internal device UUID
   * @param seenAt - Timestamp of last activity
   */
  updateLastSeen(deviceId: string, seenAt: Date): Promise<void>;

  /**
   * List active devices with pagination.
   *
   * @param limit - Maximum number to return
   * @param cursor - Opaque cursor for pagination
   * @returns Paginated list of active devices
   */
  listActive(
    limit: number,
    cursor?: string,
  ): Promise<{
    items: DeviceIdentity[];
    nextCursor: string | null;
  }>;
}

/** Injection token for the DeviceIdentityAdapter port */
export const DEVICE_IDENTITY_ADAPTER = Symbol('DEVICE_IDENTITY_ADAPTER');
