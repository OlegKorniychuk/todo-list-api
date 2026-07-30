import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('round-trips: correct password verifies true', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(
      verifyPassword('correct-horse-battery-staple', hash),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('produces a hash distinct from the plaintext', async () => {
    const plain = 'correct-horse-battery-staple';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
  });
});
