import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../../src/auth/password.js';

describe('Password Hashing', () => {
  it('should hash and verify password successfully', async () => {
    const hash = await hashPassword('test-password-123');
    expect(hash).not.toBe('test-password-123');
    expect(hash.startsWith('$2b$')).toBe(true);
    expect(await verifyPassword('test-password-123', hash)).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('should use bcrypt cost >= 12', async () => {
    const hash = await hashPassword('test');
    const cost = Number(hash.split('$')[2]);
    expect(cost).toBeGreaterThanOrEqual(12);
  });
});
