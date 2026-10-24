import {
  IdempotencyOutcome,
  checkIdempotency,
  classifyBatchIdempotency,
} from './idempotency';

describe('Idempotency', () => {
  describe('checkIdempotency', () => {
    it('should return NEW for an unseen event ID', () => {
      const existing = new Set(['aaa', 'bbb']);
      expect(checkIdempotency('ccc', existing)).toBe(IdempotencyOutcome.NEW);
    });

    it('should return DUPLICATE for an existing event ID', () => {
      const existing = new Set(['aaa', 'bbb']);
      expect(checkIdempotency('aaa', existing)).toBe(
        IdempotencyOutcome.DUPLICATE,
      );
    });

    it('should return NEW when existing set is empty', () => {
      expect(checkIdempotency('any-id', new Set())).toBe(
        IdempotencyOutcome.NEW,
      );
    });
  });

  describe('classifyBatchIdempotency', () => {
    it('should classify all as new when no existing IDs', () => {
      const result = classifyBatchIdempotency(['a', 'b', 'c'], new Set());
      expect(result.newIds).toEqual(['a', 'b', 'c']);
      expect(result.duplicateIds).toEqual([]);
    });

    it('should classify all as duplicates when all exist', () => {
      const existing = new Set(['a', 'b', 'c']);
      const result = classifyBatchIdempotency(['a', 'b', 'c'], existing);
      expect(result.newIds).toEqual([]);
      expect(result.duplicateIds).toEqual(['a', 'b', 'c']);
    });

    it('should split mixed batch correctly', () => {
      const existing = new Set(['a', 'c']);
      const result = classifyBatchIdempotency(['a', 'b', 'c', 'd'], existing);
      expect(result.newIds).toEqual(['b', 'd']);
      expect(result.duplicateIds).toEqual(['a', 'c']);
    });

    it('should handle empty input array', () => {
      const result = classifyBatchIdempotency([], new Set(['a']));
      expect(result.newIds).toEqual([]);
      expect(result.duplicateIds).toEqual([]);
    });

    it('should preserve order of IDs', () => {
      const existing = new Set(['b']);
      const result = classifyBatchIdempotency(['a', 'b', 'c'], existing);
      expect(result.newIds).toEqual(['a', 'c']);
      expect(result.duplicateIds).toEqual(['b']);
    });
  });
});
