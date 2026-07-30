import { hashToken } from './token';

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('differs for different input', () => {
    expect(hashToken('abc')).not.toBe(hashToken('xyz'));
  });
});
