import { z } from 'zod';

/**
 * UUID v4 format validation pattern.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Zod schema for validating a single location event input.
 *
 * Validation rules per PRD §6.2:
 * - latitude: [-90, 90], required, finite number
 * - longitude: [-180, 180], required, finite number
 * - accuracy_m: ≥ 0, optional
 * - captured_at: valid ISO8601/RFC3339, required
 * - event_id: valid UUID, required
 * - speed_mps: ≥ 0, optional
 * - bearing_deg: [0, 360), optional
 * - altitude_m: finite number, optional
 * - provider: string, optional
 * - schema_version: must match supported version
 */
export const locationEventInputSchema = z.object({
  eventId: z.string().regex(UUID_REGEX, 'must be a valid UUID v4'),

  deviceId: z.string().min(1, 'device ID is required'),

  latitude: z
    .number()
    .finite('must be a finite number')
    .min(-90, 'must be between -90 and 90')
    .max(90, 'must be between -90 and 90'),

  longitude: z
    .number()
    .finite('must be a finite number')
    .min(-180, 'must be between -180 and 180')
    .max(180, 'must be between -180 and 180'),

  accuracyM: z
    .number()
    .finite()
    .min(0, 'must be non-negative')
    .nullable()
    .default(null),

  capturedAt: z
    .string()
    .datetime({ message: 'must be a valid ISO8601/RFC3339 timestamp' })
    .transform((val) => new Date(val)),

  sequence: z.number().int().min(0).nullable().default(null),

  provider: z.string().max(50).nullable().default(null),

  altitudeM: z
    .number()
    .finite('must be a finite number')
    .nullable()
    .default(null),

  speedMps: z
    .number()
    .finite()
    .min(0, 'must be non-negative')
    .nullable()
    .default(null),

  bearingDeg: z
    .number()
    .finite()
    .min(0, 'must be in range [0, 360)')
    .max(360, 'must be in range [0, 360)')
    .refine((val) => val === null || val < 360, {
      message: 'must be in range [0, 360)',
    })
    .nullable()
    .default(null),

  platformVersion: z.string().max(100).nullable().default(null),

  mockLocationIndicator: z.boolean().nullable().default(null),
});

/**
 * Zod schema for validating a batch ingestion request.
 *
 * PRD §8: batch up to 5 events, flush ~5 seconds.
 * Limits are configurable via BatchValidationConfig.
 */
export const batchIngestionSchema = z.object({
  schemaVersion: z.literal(1, {
    message: 'unsupported schema version',
  }),

  events: z
    .array(locationEventInputSchema)
    .min(1, 'batch must contain at least 1 event')
    .max(500, 'batch exceeds maximum event count'),
});

/**
 * Configuration for batch validation limits.
 * All values are overridable per deployment.
 */
export interface BatchValidationConfig {
  /** Maximum number of events per batch (default: 5 per PRD §8, hard max: 500) */
  maxEventsPerBatch: number;
  /** Maximum payload size in bytes (default: 1 MiB) */
  maxPayloadBytes: number;
  /** Supported schema versions */
  supportedSchemaVersions: number[];
}

/** Default batch validation configuration per PRD §8 */
export const DEFAULT_BATCH_CONFIG: BatchValidationConfig = {
  maxEventsPerBatch: 5,
  maxPayloadBytes: 1_048_576, // 1 MiB
  supportedSchemaVersions: [1],
};

/**
 * Validate a batch of location events.
 *
 * Returns a structured result: either all events are valid, or
 * the entire batch is rejected with per-field error details.
 */
export function validateBatch(
  raw: unknown,
  config: BatchValidationConfig = DEFAULT_BATCH_CONFIG,
): BatchValidationResult {
  if (
    !Number.isInteger(config.maxEventsPerBatch) ||
    config.maxEventsPerBatch < 1
  ) {
    throw new Error('maxEventsPerBatch must be a positive integer');
  }
  if (!Number.isInteger(config.maxPayloadBytes) || config.maxPayloadBytes < 1) {
    throw new Error('maxPayloadBytes must be a positive integer');
  }
  if (
    config.supportedSchemaVersions.length === 0 ||
    config.supportedSchemaVersions.some(
      (version) => !Number.isInteger(version) || version < 1,
    )
  ) {
    throw new Error('supportedSchemaVersions must contain positive integers');
  }

  let payloadBytes: number;
  try {
    const serialized = JSON.stringify(raw);
    if (serialized === undefined) {
      return {
        valid: false,
        details: [{ field: '', reason: 'payload must be serializable JSON' }],
      };
    }
    payloadBytes = new TextEncoder().encode(serialized).byteLength;
  } catch {
    return {
      valid: false,
      details: [{ field: '', reason: 'payload must be serializable JSON' }],
    };
  }

  if (payloadBytes > config.maxPayloadBytes) {
    return {
      valid: false,
      details: [
        {
          field: '',
          reason: `payload exceeds maximum size of ${config.maxPayloadBytes} bytes`,
        },
      ],
    };
  }

  // Dynamic limits based on deployment configuration.
  const configuredSchema = z.object({
    schemaVersion: z
      .number()
      .int()
      .refine((version) => config.supportedSchemaVersions.includes(version), {
        message: 'unsupported schema version',
      }),
    events: z
      .array(locationEventInputSchema)
      .min(1, 'batch must contain at least 1 event')
      .max(
        config.maxEventsPerBatch,
        `batch exceeds maximum of ${config.maxEventsPerBatch} events`,
      ),
  });

  const result = configuredSchema.safeParse(raw);

  if (result.success) {
    return {
      valid: true,
      events: result.data.events,
      schemaVersion: result.data.schemaVersion,
    };
  }

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    reason: issue.message,
  }));

  return {
    valid: false,
    details,
  };
}

export type BatchValidationResult =
  | {
      valid: true;
      events: z.infer<typeof locationEventInputSchema>[];
      schemaVersion: number;
    }
  | { valid: false; details: { field: string; reason: string }[] };

/** Inferred type from the event input schema */
export type LocationEventInputParsed = z.infer<typeof locationEventInputSchema>;
