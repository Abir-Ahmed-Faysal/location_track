import { validateBatch, DEFAULT_BATCH_CONFIG } from './location-event.schema';

describe('LocationEvent Validation Schema', () => {
  const validEvent = {
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    deviceId: 'device-001',
    latitude: 23.8103,
    longitude: 90.4125,
    accuracyM: 12.5,
    capturedAt: '2026-10-25T00:00:00Z',
    sequence: 1,
    provider: 'FUSED',
    altitudeM: 10.0,
    speedMps: 1.5,
    bearingDeg: 90.0,
    platformVersion: 'Android 14',
    mockLocationIndicator: false,
  };

  const validBatch = {
    schemaVersion: 1,
    events: [validEvent],
  };

  describe('valid inputs', () => {
    it('should accept a valid single-event batch', () => {
      const result = validateBatch(validBatch);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.events).toHaveLength(1);
        expect(result.schemaVersion).toBe(1);
      }
    });

    it('should accept a batch with only required fields', () => {
      const minimalEvent = {
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        deviceId: 'device-001',
        latitude: 0,
        longitude: 0,
        capturedAt: '2026-10-25T00:00:00Z',
      };
      const result = validateBatch({
        schemaVersion: 1,
        events: [minimalEvent],
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.events[0].accuracyM).toBeNull();
        expect(result.events[0].altitudeM).toBeNull();
        expect(result.events[0].speedMps).toBeNull();
        expect(result.events[0].bearingDeg).toBeNull();
        expect(result.events[0].provider).toBeNull();
        expect(result.events[0].mockLocationIndicator).toBeNull();
      }
    });

    it('should accept boundary latitude values', () => {
      for (const lat of [-90, 0, 90]) {
        const event = { ...validEvent, latitude: lat };
        const result = validateBatch({ schemaVersion: 1, events: [event] });
        expect(result.valid).toBe(true);
      }
    });

    it('should accept boundary longitude values', () => {
      for (const lon of [-180, 0, 180]) {
        const event = { ...validEvent, longitude: lon };
        const result = validateBatch({ schemaVersion: 1, events: [event] });
        expect(result.valid).toBe(true);
      }
    });

    it('should accept zero accuracy', () => {
      const event = { ...validEvent, accuracyM: 0 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(true);
    });

    it('should accept bearing of 0', () => {
      const event = { ...validEvent, bearingDeg: 0 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(true);
    });

    it('should accept bearing just under 360', () => {
      const event = { ...validEvent, bearingDeg: 359.99 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(true);
    });

    it('should transform capturedAt string to Date', () => {
      const result = validateBatch(validBatch);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.events[0].capturedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject latitude below -90', () => {
      const event = { ...validEvent, latitude: -91 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject latitude above 90', () => {
      const event = { ...validEvent, latitude: 91 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject longitude below -180', () => {
      const event = { ...validEvent, longitude: -181 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject longitude above 180', () => {
      const event = { ...validEvent, longitude: 181 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject non-finite latitude (NaN)', () => {
      const event = { ...validEvent, latitude: NaN };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject non-finite latitude (Infinity)', () => {
      const event = { ...validEvent, latitude: Infinity };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject negative accuracy', () => {
      const event = { ...validEvent, accuracyM: -1 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject negative speed', () => {
      const event = { ...validEvent, speedMps: -0.1 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject bearing of exactly 360', () => {
      const event = { ...validEvent, bearingDeg: 360 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject negative bearing', () => {
      const event = { ...validEvent, bearingDeg: -1 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid UUID for eventId', () => {
      const event = { ...validEvent, eventId: 'not-a-uuid' };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject empty deviceId', () => {
      const event = { ...validEvent, deviceId: '' };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid capturedAt timestamp', () => {
      const event = { ...validEvent, capturedAt: 'not-a-date' };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
    });

    it('should reject unsupported schema version', () => {
      const result = validateBatch({ schemaVersion: 2, events: [validEvent] });
      expect(result.valid).toBe(false);
    });

    it('should reject empty events array', () => {
      const result = validateBatch({ schemaVersion: 1, events: [] });
      expect(result.valid).toBe(false);
    });

    it('should reject batch exceeding max event count', () => {
      const events = Array.from({ length: 6 }, (_, i) => ({
        ...validEvent,
        eventId: `550e8400-e29b-41d4-a716-44665544000${i}`,
      }));
      const result = validateBatch({ schemaVersion: 1, events });
      expect(result.valid).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = validateBatch({ schemaVersion: 1, events: [{}] });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.details.length).toBeGreaterThan(0);
      }
    });
  });

  describe('configurable limits', () => {
    it('should respect custom maxEventsPerBatch', () => {
      const events = Array.from({ length: 3 }, (_, i) => ({
        ...validEvent,
        eventId: `550e8400-e29b-41d4-a716-44665544000${i}`,
      }));
      const result = validateBatch(
        { schemaVersion: 1, events },
        { ...DEFAULT_BATCH_CONFIG, maxEventsPerBatch: 2 },
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('error details', () => {
    it('should provide field-level error details', () => {
      const event = { ...validEvent, latitude: 999 };
      const result = validateBatch({ schemaVersion: 1, events: [event] });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.details.some((d) => d.field.includes('latitude'))).toBe(
          true,
        );
      }
    });
  });
});
