import { isUniqueViolation } from './pg-error';

describe('isUniqueViolation', () => {
  it('returns true for a flat pg error object', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('returns true for a DrizzleQueryError-style wrapper with a nested cause', () => {
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
  });

  it('returns true for a deeply nested cause chain', () => {
    expect(isUniqueViolation({ cause: { cause: { code: '23505' } } })).toBe(
      true,
    );
  });

  it('returns false for a different pg error code', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation({ cause: { code: '23503' } })).toBe(false);
  });

  it('returns false for non-pg errors', () => {
    expect(isUniqueViolation(new Error('connection lost'))).toBe(false);
    expect(isUniqueViolation('a string')).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
