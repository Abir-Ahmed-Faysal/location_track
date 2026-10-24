// Domain types
export type {
  LocationEvent,
  LocationEventInput,
  PersistedLocationEvent,
} from './location-event.js';

// Validation schemas
export {
  locationEventInputSchema,
  batchIngestionSchema,
  validateBatch,
  DEFAULT_BATCH_CONFIG,
} from './location-event.schema.js';
export type {
  BatchValidationConfig,
  BatchValidationResult,
  LocationEventInputParsed,
} from './location-event.schema.js';

// Freshness
export {
  FreshnessStatus,
  classifyFreshness,
  calculateAgeSeconds,
  DEFAULT_FRESHNESS_CONFIG,
} from './freshness.js';
export type { FreshnessConfig } from './freshness.js';

// Accuracy
export {
  AccuracyClassification,
  classifyAccuracy,
  DEFAULT_ACCURACY_CONFIG,
} from './accuracy.js';
export type { AccuracyConfig } from './accuracy.js';

// Tracking profiles
export {
  TrackingProfileName,
  TRACKING_PROFILES,
  DEFAULT_TRACKING_PROFILE,
  createCustomProfile,
} from './tracking-profile.js';
export type { TrackingProfile } from './tracking-profile.js';

// Event ordering
export {
  compareEventOrder,
  isNewerEvent,
  LateEventPolicy,
  classifyIncomingEvent,
} from './event-ordering.js';

// Idempotency
export {
  IdempotencyOutcome,
  checkIdempotency,
  classifyBatchIdempotency,
} from './idempotency.js';

// Batch result
export {
  createEmptyBatchResult,
  createAcceptedBatchResult,
  buildBatchResult,
} from './batch-result.js';
export type { BatchResult, RejectedEvent } from './batch-result.js';

// Device identity
export { DevicePlatform, DeviceStatus } from './device-identity.js';
export type {
  DeviceIdentity,
  DeviceRegistrationInput,
} from './device-identity.js';

// Clock skew
export {
  ClockSkewStatus,
  analyzeClockSkew,
  DEFAULT_CLOCK_SKEW_CONFIG,
} from './clock-skew.js';
export type { ClockSkewConfig, ClockSkewAnalysis } from './clock-skew.js';
