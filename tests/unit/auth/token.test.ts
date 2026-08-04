import { describe, it, expect } from 'vitest';
import { TokenService } from '../../../src/auth/token.js';
import { getTestKeyPaths } from '../../helpers/test-setup.js';

describe('Token Service', () => {
  function createService(accessExpiresIn = 900): TokenService {
    const keys = getTestKeyPaths();
    return new TokenService({
      jwtPrivateKeyPath: keys.privateKeyPath,
      jwtPublicKeyPath: keys.publicKeyPath,
      jwtAccessExpiresIn: accessExpiresIn,
      jwtRefreshExpiresIn: 604800,
    });
  }

  it('should sign and verify access token', () => {
    const svc = createService();
    const tok = svc.signAccessToken({
      sub: 'u1',
      callsign: 'XA1ABC',
      role: 'user',
      locale: 'en',
    });
    const p = svc.verifyAccessToken(tok);
    expect(p.sub).toBe('u1');
    expect(p.callsign).toBe('XA1ABC');
    expect(p.role).toBe('user');
    expect(p.locale).toBe('en');
    expect(p.iss).toBe('hermes-backend');
  });

  it('should sign and verify refresh token', () => {
    const svc = createService();
    const tok = svc.signRefreshToken('u2');
    const p = svc.verifyRefreshToken(tok);
    expect(p.sub).toBe('u2');
    expect(p.type).toBe('refresh');
    expect(p.iss).toBe('hermes-backend');
  });

  it('should reject expired access token', () => {
    const expired = createService(-1);
    const tok = expired.signAccessToken({
      sub: 'x',
      callsign: 'X',
      role: 'user',
      locale: 'en',
    });
    expect(() => expired.verifyAccessToken(tok)).toThrow();
  });
});
