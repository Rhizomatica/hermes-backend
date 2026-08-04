import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestTables, createTestConfig } from '../../helpers/test-setup.js';
import { buildApp } from '../../../src/app.js';
import { hashPassword } from '../../../src/auth/password.js';
import type { FastifyInstance } from 'fastify';
import type { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { SQLiteAdapter as SqliteAdapterClass } from '../../../src/db/sqlite.adapter.js';

interface SafeUser {
  id: string;
  callsign: string;
  displayName: string;
  email: string | null;
  role: string;
  status: string;
  avatarPath: string | null;
  locale: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
}

describe('User Endpoints', () => {
  let app: FastifyInstance;
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    const config = createTestConfig();
    adapter = new SqliteAdapterClass(':memory:');
    createTestTables(adapter);
    app = await buildApp({ config, adapter });
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

  describe('GET /users/me', () => {
    it('should return the authenticated user profile', async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<SafeUser>();
      expect(body.id).toBe(user.id);
      expect(body.callsign).toBe(user.callsign);
      expect(body.role).toBe('user');
      expect(body.status).toBe('active');
      expect(body.locale).toBe('en');
      // Password hash must NOT be in response
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when no token is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when user sends an invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: 'Bearer invalid.token.here' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 if the user no longer exists in the database', async () => {
      // Create a token for a user, then delete the user
      const user = await createTestUser();

      // Delete the user from the database
      await app.services.users.delete(user.id);

      const response = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      // JWT verifier middleware checks user existence before route handler
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /users', () => {
    it('should allow admin to create a new user', async () => {
      const admin = await createTestUser(undefined, 'admin');

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          authorization: `Bearer ${admin.accessToken}`,
          'content-type': 'application/json',
        },
        payload: {
          callsign: 'XA9NEWU',
          displayName: 'New User',
          password: 'securepass123',
          role: 'operator',
          locale: 'es',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<SafeUser>();
      expect(body.callsign).toBe('XA9NEWU');
      expect(body.displayName).toBe('New User');
      expect(body.role).toBe('operator');
      expect(body.locale).toBe('es');
      expect(body.status).toBe('active');
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('should return 403 when non-admin tries to create a user', async () => {
      const user = await createTestUser(undefined, 'operator');

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          authorization: `Bearer ${user.accessToken}`,
          'content-type': 'application/json',
        },
        payload: {
          callsign: 'XA9FAIL',
          displayName: 'Should Fail',
          password: 'securepass123',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 401 when unauthenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: { 'content-type': 'application/json' },
        payload: {
          callsign: 'XA9FAIL',
          displayName: 'Should Fail',
          password: 'securepass123',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 409 when callsign already exists', async () => {
      const admin = await createTestUser(undefined, 'admin');
      const existing = await createTestUser('XA9DUP', 'user');

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          authorization: `Bearer ${admin.accessToken}`,
          'content-type': 'application/json',
        },
        payload: {
          callsign: 'XA9DUP',
          displayName: 'Duplicate',
          password: 'securepass123',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: string }>().error).toBe('user.callsign_exists');
    });

    it('should reject missing required fields', async () => {
      const admin = await createTestUser(undefined, 'admin');

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          authorization: `Bearer ${admin.accessToken}`,
          'content-type': 'application/json',
        },
        payload: {
          // Missing callsign and displayName
          password: 'short',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should default role to user and locale to en when not provided', async () => {
      const admin = await createTestUser(undefined, 'admin');

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          authorization: `Bearer ${admin.accessToken}`,
          'content-type': 'application/json',
        },
        payload: {
          callsign: 'XA9DEF',
          displayName: 'Default Role User',
          password: 'securepass123',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<SafeUser>();
      expect(body.role).toBe('user');
      expect(body.locale).toBe('en');
    });
  });

  describe('GET /users', () => {
    it('should allow admin to list all users', async () => {
      const admin = await createTestUser(undefined, 'admin');
      await createTestUser('XA9LIST1', 'user');
      await createTestUser('XA9LIST2', 'operator');

      const response = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<SafeUser[]>();
      expect(body.length).toBeGreaterThanOrEqual(3); // admin + 2 users
      // No user should have passwordHash exposed
      for (const u of body) {
        expect(u).not.toHaveProperty('passwordHash');
      }
    });

    it('should return 403 when non-admin tries to list users', async () => {
      const user = await createTestUser(undefined, 'user');

      const response = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 401 when unauthenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});