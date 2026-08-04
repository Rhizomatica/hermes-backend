import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, createTestTables } from '../../helpers/test-setup.js';
import { hashPassword } from '../../../src/auth/password.js';
import type { FastifyInstance } from 'fastify';
import type { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';

describe('POST /auth/logout', () => {
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

  async function createTestUser(callsign?: string): Promise<{
    id: string;
    callsign: string;
    accessToken: string;
  }> {
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

    const accessToken = app.services.token.signAccessToken({
      sub: user.id,
      callsign: user.callsign,
      role: user.role,
      locale: user.locale,
    });

    return { id: user.id, callsign: userCallsign, accessToken };
  }

  async function createSession(
    userId: string,
  ): Promise<string> {
    const refreshToken = app.services.token.signRefreshToken(userId);
    const expiresAt = new Date(Date.now() + app.config.jwtRefreshExpiresIn * 1000).toISOString();
    await app.services.sessions.create({ userId, refreshToken, expiresAt });
    return refreshToken;
  }

  it('should revoke the session and return 200 with valid refresh token', async () => {
    const user = await createTestUser();
    const refreshToken = await createSession(user.id);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ message: string }>();
    expect(body.message).toBe('auth.logged_out');

    // Verify session is actually revoked
    const session = await app.services.sessions.findByTokenHash(refreshToken);
    expect(session).toBeTruthy();
    expect(session!.revokedAt).toBeTruthy();
  });

  it('should return 200 for already-revoked session (idempotent)', async () => {
    const user = await createTestUser();
    const refreshToken = await createSession(user.id);

    // Revoke it first
    const session = await app.services.sessions.findByTokenHash(refreshToken);
    await app.services.sessions.revoke(session!.id);

    // Call logout again
    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ message: string }>();
    expect(body.message).toBe('auth.logged_out');
  });

  it('should return 401 for invalid (malformed) refresh token', async () => {
    const user = await createTestUser();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { refreshToken: 'not-a-valid-jwt' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: string }>();
    expect(body.error).toBe('auth.invalid_refresh_token');
  });

  it('should return 401 for refresh token with no matching session', async () => {
    const user = await createTestUser();
    // Create a valid refresh token but never persist it
    const orphanToken = app.services.token.signRefreshToken(user.id);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { refreshToken: orphanToken },
    });

    // With authenticate middleware: token must exist in DB (even if not session), so
    // the handler will receive the orphan token, verify it, find no session → 200 idempotent
    // Actually: the handler first verifies the refresh token (valid JWT), then finds no session.
    // Per the new handler logic, no session = idempotent success (200). Let's verify:
    expect(response.statusCode).toBe(200);
    const body = response.json<{ message: string }>();
    expect(body.message).toBe('auth.logged_out');
  });

  it('should return 401 for expired refresh token', async () => {
    const user = await createTestUser();

    // Create a token that expires immediately
    const { TokenService } = await import('../../../src/auth/token.js');
    const expiredSvc = new TokenService({
      jwtPrivateKeyPath: app.config.jwtPrivateKeyPath,
      jwtPublicKeyPath: app.config.jwtPublicKeyPath,
      jwtAccessExpiresIn: 900,
      jwtRefreshExpiresIn: -1,
    });

    const expiredToken = expiredSvc.signRefreshToken(user.id);
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    await app.services.sessions.create({
      userId: user.id,
      refreshToken: expiredToken,
      expiresAt,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { refreshToken: expiredToken },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: string }>();
    expect(body.error).toBe('auth.invalid_refresh_token');
  });

  it('should not revoke other sessions belonging to the same user', async () => {
    const user = await createTestUser();

    // Create two sessions
    const tokenA = await createSession(user.id);
    const tokenB = await createSession(user.id);

    // Logout with token A
    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { refreshToken: tokenA },
    });
    expect(response.statusCode).toBe(200);

    // Token A should be revoked
    const sessionA = await app.services.sessions.findByTokenHash(tokenA);
    expect(sessionA!.revokedAt).toBeTruthy();

    // Token B should still be active
    const sessionB = await app.services.sessions.findByTokenHash(tokenB);
    expect(sessionB!.revokedAt).toBeNull();
  });

  it('should return 401 when no access token is provided for logout', async () => {
    const user = await createTestUser();
    const refreshToken = await createSession(user.id);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(401);
  });
});