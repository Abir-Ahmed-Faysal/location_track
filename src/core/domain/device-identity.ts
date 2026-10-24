/**
 * Device identity within the location engine.
 *
 * PRD §6.2: device_id is a stable device identity within the integration's ownership model.
 * PRD §11: Use replaceable device identity adapters.
 */
export interface DeviceIdentity {
  /** Internal device ID (UUID) */
  readonly deviceId: string;

  /** External device key — the identity known to the integrating application */
  readonly externalDeviceKey: string;

  /** Platform identifier (e.g., 'ANDROID', 'IOS', 'WEB') */
  readonly platform: DevicePlatform;

  /** Current device status */
  readonly status: DeviceStatus;

  /** Last time the device was seen (sent data or connected) */
  readonly lastSeenAt: Date | null;

  /** When the device was registered */
  readonly createdAt: Date;
}

export enum DevicePlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB = 'WEB',
  OTHER = 'OTHER',
}

export enum DeviceStatus {
  /** Device is registered and active */
  ACTIVE = 'ACTIVE',

  /** Device registration has been revoked */
  REVOKED = 'REVOKED',
}

/**
 * Input for registering a new device.
 */
export interface DeviceRegistrationInput {
  /** External key identifying this device in the integrating application */
  readonly externalDeviceKey: string;

  /** Platform the device runs on */
  readonly platform: DevicePlatform;
}
