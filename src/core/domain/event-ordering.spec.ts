import {
  compareEventOrder,
  isNewerEvent,
  LateEventPolicy,
  classifyIncomingEvent,
} from './event-ordering';

describe('Event Ordering', () => {
  const makeEvent = (
    capturedAt: string,
    sequence: number | null = null,
    eventId = '550e8400-e29b-41d4-a716-446655440000',
  ) => ({
    capturedAt: new Date(capturedAt),
    sequence,
    eventId,
  });

  describe('compareEventOrder', () => {
    it('should return negative when a is older than b (by captured_at)', () => {
      const a = makeEvent('2026-10-25T12:00:00Z');
      const b = makeEvent('2026-10-25T12:00:10Z');
      expect(compareEventOrder(a, b)).toBeLessThan(0);
    });

    it('should return positive when a is newer than b (by captured_at)', () => {
      const a = makeEvent('2026-10-25T12:00:10Z');
      const b = makeEvent('2026-10-25T12:00:00Z');
      expect(compareEventOrder(a, b)).toBeGreaterThan(0);
    });

    it('should use sequence as tiebreaker when captured_at is equal', () => {
      const a = makeEvent('2026-10-25T12:00:00Z', 1);
      const b = makeEvent('2026-10-25T12:00:00Z', 2);
      expect(compareEventOrder(a, b)).toBeLessThan(0);
    });

    it('should use eventId as final tiebreaker', () => {
      const a = makeEvent(
        '2026-10-25T12:00:00Z',
        null,
        'aaaa0000-0000-4000-8000-000000000000',
      );
      const b = makeEvent(
        '2026-10-25T12:00:00Z',
        null,
        'bbbb0000-0000-4000-8000-000000000000',
      );
      expect(compareEventOrder(a, b)).toBeLessThan(0);
    });

    it('should return 0 for identical events', () => {
      const a = makeEvent(
        '2026-10-25T12:00:00Z',
        1,
        'aaaa0000-0000-4000-8000-000000000000',
      );
      const b = makeEvent(
        '2026-10-25T12:00:00Z',
        1,
        'aaaa0000-0000-4000-8000-000000000000',
      );
      expect(compareEventOrder(a, b)).toBe(0);
    });

    it('should skip sequence comparison when one is null', () => {
      const a = makeEvent(
        '2026-10-25T12:00:00Z',
        null,
        'aaaa0000-0000-4000-8000-000000000000',
      );
      const b = makeEvent(
        '2026-10-25T12:00:00Z',
        5,
        'bbbb0000-0000-4000-8000-000000000000',
      );
      // Falls through to eventId comparison
      expect(compareEventOrder(a, b)).toBeLessThan(0);
    });
  });

  describe('isNewerEvent', () => {
    it('should return true when current is null (first event)', () => {
      const incoming = makeEvent('2026-10-25T12:00:00Z');
      expect(isNewerEvent(incoming, null)).toBe(true);
    });

    it('should return true when incoming is newer', () => {
      const incoming = makeEvent('2026-10-25T12:00:10Z');
      const current = makeEvent('2026-10-25T12:00:00Z');
      expect(isNewerEvent(incoming, current)).toBe(true);
    });

    it('should return false when incoming is older (historical replay)', () => {
      const incoming = makeEvent('2026-10-25T12:00:00Z');
      const current = makeEvent('2026-10-25T12:00:10Z');
      expect(isNewerEvent(incoming, current)).toBe(false);
    });

    it('should return false when incoming is same time and same id', () => {
      const incoming = makeEvent('2026-10-25T12:00:00Z');
      const current = makeEvent('2026-10-25T12:00:00Z');
      // Same eventId = compareEventOrder returns 0 = not newer
      expect(isNewerEvent(incoming, current)).toBe(false);
    });
  });

  describe('classifyIncomingEvent', () => {
    it('should classify as DUPLICATE when eventId exists', () => {
      const incoming = makeEvent('2026-10-25T12:00:10Z');
      const existing = new Set([incoming.eventId]);
      const result = classifyIncomingEvent(incoming, null, existing);
      expect(result).toBe(LateEventPolicy.DUPLICATE);
    });

    it('should classify as ACCEPT_AND_UPDATE_LATEST when newer', () => {
      const incoming = makeEvent(
        '2026-10-25T12:00:10Z',
        null,
        'bbbb0000-0000-4000-8000-000000000000',
      );
      const current = makeEvent(
        '2026-10-25T12:00:00Z',
        null,
        'aaaa0000-0000-4000-8000-000000000000',
      );
      const result = classifyIncomingEvent(incoming, current, new Set());
      expect(result).toBe(LateEventPolicy.ACCEPT_AND_UPDATE_LATEST);
    });

    it('should classify as ACCEPT_NO_LATEST_UPDATE when older (late arrival)', () => {
      const incoming = makeEvent(
        '2026-10-25T12:00:00Z',
        null,
        'aaaa0000-0000-4000-8000-000000000000',
      );
      const current = makeEvent(
        '2026-10-25T12:00:10Z',
        null,
        'bbbb0000-0000-4000-8000-000000000000',
      );
      const result = classifyIncomingEvent(incoming, current, new Set());
      expect(result).toBe(LateEventPolicy.ACCEPT_NO_LATEST_UPDATE);
    });

    it('should classify as ACCEPT_AND_UPDATE_LATEST when no current exists', () => {
      const incoming = makeEvent('2026-10-25T12:00:00Z');
      const result = classifyIncomingEvent(incoming, null, new Set());
      expect(result).toBe(LateEventPolicy.ACCEPT_AND_UPDATE_LATEST);
    });

    it('should prioritize DUPLICATE over ACCEPT_AND_UPDATE_LATEST', () => {
      const incoming = makeEvent('2026-10-25T12:00:10Z');
      const current = makeEvent(
        '2026-10-25T12:00:00Z',
        null,
        'aaaa0000-0000-4000-8000-000000000000',
      );
      const existing = new Set([incoming.eventId]);
      const result = classifyIncomingEvent(incoming, current, existing);
      expect(result).toBe(LateEventPolicy.DUPLICATE);
    });
  });
});
