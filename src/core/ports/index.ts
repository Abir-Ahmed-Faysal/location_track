export type {
  EventStore,
  HistoryQuery,
  PaginatedEvents,
} from './event-store.port.js';
export { EVENT_STORE } from './event-store.port.js';

export type {
  LatestLocationStore,
  LatestLocation,
} from './latest-location.port.js';
export { LATEST_LOCATION_STORE } from './latest-location.port.js';

export type { AuthAdapter, AuthCredentials, AuthContext } from './auth.port.js';
export { AUTH_ADAPTER } from './auth.port.js';

export type { DeviceIdentityAdapter } from './device-identity.port.js';
export { DEVICE_IDENTITY_ADAPTER } from './device-identity.port.js';

export type { RealtimePublisher } from './realtime-publisher.port.js';
export { REALTIME_PUBLISHER } from './realtime-publisher.port.js';

export type { Clock } from './clock.port.js';
export { SystemClock, FixedClock, CLOCK } from './clock.port.js';
