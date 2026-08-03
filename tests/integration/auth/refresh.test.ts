import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { buildApp } from '../../../src/app.js';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { UsersRepository } from '../../../src/db/repositories/users.repository.js';
import { SessionsRepository } from '../../../src/db/repositories/sessions.repository.js';
import { TokenService } from '../../../src/auth/token.js';
import { hashPassword } from '../../../src/auth/password.js';
import type { AppConfig } from '../../../src/shared/config.js';
import type { FastifyInstance } from 'fastify';

const PRIV = '/tmp/test-refresh-priv.pem';
const PUB = '/tmp/test-refresh-pub.pem';

const testConfig: AppConfig = {
  databasePath: ':memory:',
  port: 0,
  host: '127.0.0.1',
  corsOrigins: '*',
  logLevel: 'silent',
  radioDriver: 'simulated',
  dbAdapter: 'sqlite',
  jwtPrivateKeyPath: PRIV,
  jwtPublicKeyPath: PUB,
  jwtAccessExpiresIn: 900,
  jwtRefreshExpiresIn: 604800,
};

function buildTokenSvc(overrides: Partial<Pick<AppConfig, 'jwtAccessExpiresIn' | 'jwtRefreshExpiresIn'>> = {}): TokenService {
  return new TokenService({ ...testConfig, ...overrides });
}

describe('POST /auth/refresh', () => {
  let app: FastifyInstance;
  let adapter: SQLiteAdapter;
  let usersRepo: UsersRepository;
  let sessionsRepo: SessionsRepository;

  beforeAll(async () => {
    execSync(`openssl genrsa -out ${PRIV} 2048 2>/dev/null`);
    execSync(`openssl rsa -in ${PRIV} -pubout -out ${PUB} 2>/dev/null`);

    adapter = new SQLiteAdapter(':memory:');

    // Create tables manually for in-memory DB
    adapter.db.run(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        callsign TEXT NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT,
        password_hash TEXT,
        role TEXT DEFAULT 'user' NOT NULL CHECK(role IN ('admin', 'operator', 'user', 'readonly')),
        status TEXT DEFAULT 'active' NOT NULL CHECK(status IN ('active', 'suspended', 'pending')),
        avatar_path TEXT,
        metadata TEXT DEFAULT '{}' NOT NULL,
        locale TEXT DEFAULT 'en' NOT NULL CHECK(locale IN ('en', 'es', 'pt-BR')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen_at TEXT
      )
    `);
    adapter.db.run('CREATE UNIQUE INDEX users_callsign_unique ON users (callsign)');
    adapter.db.run('CREATE UNIQUE INDEX users_email_unique ON users (email)');

    adapter.db.run(`
      CREATE TABLE user_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        device_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        refresh_replaced_by TEXT,
        created_at TEXT NOT NULL
      )
    `);
    adapter.db.run('CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id)');
    adapter.db.run('CREATE INDEX idx_user_sessions_token_hash ON user_sessions (token_hash)');
    adapter.db.run('CREATE INDEX idx_user_sessions_expires_active ON user_sessions (expires_at)');

    usersRepo = new UsersRepository(adapter);
    sessionsRepo = new SessionsRepository(adapter);

    app = await buildApp({ config: testConfig, adapter });
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
    await adapter.close();
  });

  async function createTestUser(callsign?: string): Promise<{ id: string; callsign: string }> {
    const passwordHash = await hashPassword('testpass123');
    const userCallsign = callsign ?? `XA1${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const user = await usersRepo.create({
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
    const tokenSvc = buildTokenSvc();
    const refreshToken = tokenSvc.signRefreshToken(userId);
    const expiresAt = new Date(Date.now() + testConfig.jwtRefreshExpiresIn * 1000).toISOString();
    await sessionsRepo.create({ userId, refreshToken, expiresAt });
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
    const tokenSvc = new TokenService(testConfig);
    const payload = tokenSvc.verifyAccessToken(body.accessToken);
    expect(payload.sub).toBe(user.id);
    expect(payload.callsign).toBe(user.callsign);
    expect(payload.role).toBe('user');
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
    // Create a token that expires immediately
    const expiredSvc = buildTokenSvc({ jwtRefreshExpiresIn: -1 });
    const user = await createTestUser();
    const expiredToken = expiredSvc.signRefreshToken(user.id);
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // already expired
    await sessionsRepo.create({ userId: user.id, refreshToken: expiredToken, expiresAt });

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
    const session = await sessionsRepo.findByActiveTokenHash(refreshToken);
    if (session) {
      await sessionsRepo.revoke(session.id);
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