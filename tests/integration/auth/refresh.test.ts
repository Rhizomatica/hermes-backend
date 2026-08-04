import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, createTestTables } from '../../helpers/test-setup.js';
import { hashPassword } from '../../../src/auth/password.js';
import type { FastifyInstance } from 'fastify';
import type { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';

describe('POST /auth/refresh', () => {
  let app: FastifyInstance;
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    adapter = ctx.adapter;
    createTestTables(adapter);
  });

  afterAll(async () => {
    await app.close();
    await adapter.close();
  });

  async function createTestUser(callsign?: string): Promise<{ id: string; callsign: string }> {
    const passwordHash = await hashPassword('testpass123');
    const userCallsign = callsign ?? `XA1${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const user = await app.services.users.create({
      callsign: userCallsign,
      displayName: 'Test User',
      email: null,
      passwordHash,
      role: 'user',
      status: 'active',
      avatarPath: null,
      metadata: '{}',
      locale: 'en',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSeenAt: null,
    });
    return { id: user.id, callsign: userCallsign };
  }

  async function createSession(userId: string): Promise<string> {
    const refreshToken = app.services.token.signRefreshToken(userId);
    const expiresAt = new Date(Date.now() + app.config.jwtRefreshExpiresIn * 1000).toISOString();
    await app.services.sessions.create({ userId, refreshToken, expiresAt });
    return refreshToken;
  }

  it('should issue new token pair with valid refresh token', async () => {
    const user = await createTestUser();
    const oldRefreshToken = await createSession(user.id);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ accessToken: string; refreshToken: string; expiresIn: number }>();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.refreshToken).not.toBe(oldRefreshToken); // rotation: new token
    expect(body.expiresIn).toBe(900);

    // Verify new access token is valid
    const payload = app.services.token.verifyAccessToken(body.accessToken);
    expect(payload.sub).toBe(user.id);
    expect(payload.callsign).toBe(user.callsign);
    expect(payload.role).toBe('user');
    expect(payload.iss).toBe('hermes-backend');
  });

  it('should detect reuse when same refresh token used twice', async () => {
    const user = await createTestUser();
    const oldRefreshToken = await createSession(user.id);

    // First refresh — should succeed
    const firstResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    });
    expect(firstResponse.statusCode).toBe(200);

    // Second refresh with same (now-replaced) token — reuse detection
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    });
    expect(secondResponse.statusCode).toBe(401);
    const body = secondResponse.json<{ error: string }>();
    expect(body.error).toBe('auth.token_reuse_detected');
  });

  it('should return 401 for invalid refresh token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'invalid-token-not-a-jwt' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: string }>();
    expect(body.error).toBe('auth.invalid_refresh_token');
  });

  it('should return 401 for expired refresh token', async () => {
    // Create a user with default app, then create an expired token manually
    const user = await createTestUser();

    // Need a TokenService with negative expiry — create a separate adapter just for that
    const { TokenService } = await import('../../../src/auth/token.js');
    const expiredSvc = new TokenService({
      jwtPrivateKeyPath: app.config.jwtPrivateKeyPath,
      jwtPublicKeyPath: app.config.jwtPublicKeyPath,
      jwtAccessExpiresIn: 900,
      jwtRefreshExpiresIn: -1,
    });

    const expiredToken = expiredSvc.signRefreshToken(user.id);
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // already expired
    await app.services.sessions.create({ userId: user.id, refreshToken: expiredToken, expiresAt });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: expiredToken },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: string }>();
    expect(body.error).toBe('auth.invalid_refresh_token'); // JWT verify fails due to exp
  });

  it('should return 401 for revoked session', async () => {
    const user = await createTestUser();
    const refreshToken = await createSession(user.id);

    // Revoke the session
    const session = await app.services.sessions.findByActiveTokenHash(refreshToken);
    if (session) {
      await app.services.sessions.revoke(session.id);
    }

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: string }>();
    expect(body.error).toBe('auth.token_revoked');
  });
});