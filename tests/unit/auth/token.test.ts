import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { TokenService } from '../../../src/auth/token.js';

const PRIV = '/tmp/test-token-priv.pem';
const PUB = '/tmp/test-token-pub.pem';

describe('Token Service', () => {
  beforeAll(() => {
    execSync(`openssl genrsa -out ${PRIV} 2048 2>/dev/null`);
    execSync(`openssl rsa -in ${PRIV} -pubout -out ${PUB} 2>/dev/null`);
  });

  function createService(accessExpiresIn = 900): TokenService {
    return new TokenService({
      jwtPrivateKeyPath: PRIV,
      jwtPublicKeyPath: PUB,
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
  });

  it('should sign and verify refresh token', () => {
    const svc = createService();
    const tok = svc.signRefreshToken('u2');
    const p = svc.verifyRefreshToken(tok);
    expect(p.sub).toBe('u2');
    expect(p.type).toBe('refresh');
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