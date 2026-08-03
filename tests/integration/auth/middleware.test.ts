import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestTables, createTestConfig } from '../../helpers/test-setup.js';
import { buildApp } from '../../../src/app.js';
import { hashPassword } from '../../../src/auth/password.js';
import { requireRole } from '../../../src/auth/middleware/rbac-guard.js';
import type { FastifyInstance } from 'fastify';
import type { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { SQLiteAdapter as SqliteAdapterClass } from '../../../src/db/sqlite.adapter.js';

interface ErrorBody {
  type: string;
  title: string;
  status: number;
  code: string;
  message: string;
}

interface OkBody {
  ok: boolean;
  role?: string;
}

describe('Auth Middleware Chain', () => {
  let app: FastifyInstance;
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    const config = createTestConfig();
    adapter = new SqliteAdapterClass(':memory:');
    createTestTables(adapter);
    app = await buildApp({ config, adapter });

    // Register all test routes before ready()
    app.get('/test-protected', {
      preHandler: [app.authenticate],
    }, async (_request, reply) => {
      return reply.send({ ok: true });
    });

    app.get('/test-admin-only', {
      preHandler: [app.authenticate, requireRole('admin')],
    }, async (_request, reply) => {
      return reply.send({ ok: true, role: 'admin' });
    });

    app.get('/test-operator-plus', {
      preHandler: [app.authenticate, requireRole('admin', 'operator')],
    }, async (_request, reply) => {
      return reply.send({ ok: true });
    });

    app.get('/test-all-roles', {
      preHandler: [app.authenticate, requireRole('admin', 'operator', 'user', 'readonly')],
    }, async (_request, reply) => {
      return reply.send({ ok: true });
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await adapter.close();
  });

  async function createTestUser(
    callsign?: string,
    role: 'admin' | 'operator' | 'user' | 'readonly' = 'user',
  ) {
    const passwordHash = await hashPassword('testpass123');
    const userCallsign = callsign ?? `XA1${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const user = await app.services.users.create({
      callsign: userCallsign,
      displayName: 'Test User',
      email: null,
      passwordHash,
      role,
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

    return { id: user.id, callsign: userCallsign, accessToken, role: user.role };
  }

  describe('JWT Verifier (app.authenticate)', () => {
    it('should return 401 when no Authorization header is present', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ErrorBody>();
      expect(body.code).toBe('UNAUTHENTICATED');
      expect(body.message).toBe('Missing access token');
      expect(body.type).toContain('hermes.example.com/errors/unauthenticated');
      expect(body.title).toBe('Unauthorized');
      expect(body.status).toBe(401);
    });

    it('should return 401 when Authorization header is not Bearer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ErrorBody>();
      expect(body.code).toBe('UNAUTHENTICATED');
      expect(body.message).toBe('Invalid access token');
    });

    it('should return 401 for invalid/malformed token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: 'Bearer totally.invalid.token' },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ErrorBody>();
      expect(body.code).toBe('UNAUTHENTICATED');
    });

    it('should return 401 for an expired token', async () => {
      // Create a token that has already expired using the app's own key pair
      const now = Math.floor(Date.now() / 1000);
      const jwt = await import('jsonwebtoken');
      const { readFileSync } = await import('node:fs');
      const privateKey = readFileSync(app.config.jwtPrivateKeyPath, 'utf8');

      const expiredToken = jwt.default.sign(
        {
          sub: '00000000-0000-0000-0000-000000000000',
          callsign: 'XA0EXP',
          role: 'user',
          locale: 'en',
          iss: 'hermes-backend',
          iat: now - 120,
          exp: now - 60,
        },
        privateKey,
        { algorithm: 'RS256' },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${expiredToken}` },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ErrorBody>();
      expect(body.code).toBe('TOKEN_EXPIRED');
      expect(body.message).toBe('Access token has expired');
    });

    it('should return 401 when token is for a non-existent user', async () => {
      const phantomToken = app.services.token.signAccessToken({
        sub: '00000000-0000-0000-0000-000000000000',
        callsign: 'XA0GHOST',
        role: 'user',
        locale: 'en',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${phantomToken}` },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ErrorBody>();
      expect(body.code).toBe('UNAUTHENTICATED');
    });

    it('should allow access with a valid token', async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<OkBody>().ok).toBe(true);
    });

    it('should return 401 when user is suspended', async () => {
      const user = await createTestUser();

      // Suspend the user
      await app.services.users.update(user.id, { status: 'suspended' });

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ErrorBody>();
      expect(body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('RBAC Guard (requireRole)', () => {
    it('should return 403 when user role is not in allowed roles', async () => {
      const user = await createTestUser(undefined, 'user');

      const response = await app.inject({
        method: 'GET',
        url: '/test-admin-only',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json<ErrorBody>();
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toBe('Insufficient permissions for this operation');
      expect(body.type).toContain('hermes.example.com/errors/forbidden');
      expect(body.title).toBe('Forbidden');
      expect(body.status).toBe(403);
    });

    it('should allow admin to access admin-only route', async () => {
      const admin = await createTestUser(undefined, 'admin');

      const response = await app.inject({
        method: 'GET',
        url: '/test-admin-only',
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<OkBody>().role).toBe('admin');
    });

    it('should allow operator to access operator+ route', async () => {
      const operator = await createTestUser(undefined, 'operator');

      const response = await app.inject({
        method: 'GET',
        url: '/test-operator-plus',
        headers: { authorization: `Bearer ${operator.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject user from operator+ route', async () => {
      const user = await createTestUser(undefined, 'user');

      const response = await app.inject({
        method: 'GET',
        url: '/test-operator-plus',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow readonly to access all-roles route', async () => {
      const readonly = await createTestUser(undefined, 'readonly');

      const response = await app.inject({
        method: 'GET',
        url: '/test-all-roles',
        headers: { authorization: `Bearer ${readonly.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 401 when no token present on RBAC route', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-admin-only',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Security Headers (Helmet)', () => {
    it('should set X-XSS-Protection header', async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should set X-Content-Type-Options header', async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set Strict-Transport-Security header', async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains',
      );
    });

    it('should set Content-Security-Policy header', async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('should allow requests from allowed origin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'http://localhost:5173' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Rate Limiter', () => {
    it('should allow requests under the rate limit', async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});