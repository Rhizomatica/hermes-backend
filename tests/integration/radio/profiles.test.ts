import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestConfig } from '../../helpers/test-setup.js';
import { buildApp } from '../../../src/app.js';
import { hashPassword } from '../../../src/auth/password.js';
import type { FastifyInstance } from 'fastify';
import type { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { SQLiteAdapter as SqliteAdapterClass } from '../../../src/db/sqlite.adapter.js';

function createTestTables(adapter: SQLiteAdapter): void {
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
  adapter.db.run('CREATE UNIQUE INDEX IF NOT EXISTS users_callsign_unique ON users (callsign)');
  adapter.db.run('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)');

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

  adapter.db.run(`
    CREATE TABLE radio_profiles (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      profile_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      frequency_hz INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL')),
      volume INTEGER NOT NULL DEFAULT 50 CHECK(volume BETWEEN 0 AND 100),
      bfo_hz INTEGER NOT NULL DEFAULT 0,
      digital_voice INTEGER NOT NULL DEFAULT 0,
      power_level INTEGER,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (station_id, profile_index)
    )
  `);
}

interface ProfileResponse {
  id: string;
  stationId: string;
  profileIndex: number;
  name: string;
  frequencyHz: number;
  mode: string;
  volume: number;
  bfoHz: number;
  digitalVoice: number;
  powerLevel: number | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

describe('Radio Profiles Endpoints', () => {
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
    role: 'admin' | 'operator' | 'user' | 'readonly' = 'operator',
  ): Promise<{ id: string; callsign: string; accessToken: string; role: string }> {
    const passwordHash = await hashPassword('testpass123');
    const callsign = `XA1${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const user = await app.services.users.create({
      callsign,
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

    return { id: user.id, callsign, accessToken, role: user.role };
  }

  // -- GET /radio/profiles (list) ------------------------------------

  describe('GET /radio/profiles', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/radio/profiles',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/radio/profiles',
        headers: { authorization: 'Bearer invalid.token' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return empty array when user has no profiles', async () => {
      const user = await createTestUser('user');

      const response = await app.inject({
        method: 'GET',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it('should list profiles for the authenticated user', async () => {
      const user = await createTestUser('operator');

      // Insert test profiles directly.
      const now = new Date().toISOString();
      adapter.db.run(
        `INSERT INTO radio_profiles (id, station_id, profile_index, name, frequency_hz, mode, volume, bfo_hz, digital_voice, is_active, created_at, updated_at)
         VALUES ('p1', '${user.id}', 0, '40m USB', 7100000, 'USB', 50, 0, 0, 1, '${now}', '${now}')`,
      );
      adapter.db.run(
        `INSERT INTO radio_profiles (id, station_id, profile_index, name, frequency_hz, mode, volume, bfo_hz, digital_voice, is_active, created_at, updated_at)
         VALUES ('p2', '${user.id}', 1, '20m CW', 14000000, 'CW', 40, 800, 0, 0, '${now}', '${now}')`,
      );

      const response = await app.inject({
        method: 'GET',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const profiles = response.json<ProfileResponse[]>();
      expect(profiles.length).toBe(2);
      expect(profiles[0].name).toBe('40m USB');
      expect(profiles[1].name).toBe('20m CW');
    });
  });

  // -- POST /radio/profiles (create) ---------------------------------

  describe('POST /radio/profiles', () => {
    it('should return 401 without auth (valid body, no token)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        payload: {
          stationId: 'some-id',
          profileIndex: 0,
          name: 'Test',
          frequencyHz: 7100000,
          mode: 'USB',
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for non-operator user', async () => {
      const user = await createTestUser('user');

      const response = await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          stationId: user.id,
          profileIndex: 0,
          name: 'Test Profile',
          frequencyHz: 7100000,
          mode: 'USB',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow operator to create a profile', async () => {
      const user = await createTestUser('operator');

      const response = await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          stationId: user.id,
          profileIndex: 0,
          name: '40m Phone',
          frequencyHz: 7150000,
          mode: 'LSB',
          volume: 60,
        },
      });

      expect(response.statusCode).toBe(201);
      const profile = response.json<ProfileResponse>();
      expect(profile.id).toBeDefined();
      expect(profile.stationId).toBe(user.id);
      expect(profile.profileIndex).toBe(0);
      expect(profile.name).toBe('40m Phone');
      expect(profile.frequencyHz).toBe(7150000);
      expect(profile.mode).toBe('LSB');
      expect(profile.volume).toBe(60);
      expect(profile.bfoHz).toBe(0);
      expect(profile.digitalVoice).toBe(0);
      expect(profile.isActive).toBe(0);
      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
    });

    it('should reject duplicate profileIndex for same station', async () => {
      const user = await createTestUser('operator');

      // Create first profile.
      await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          stationId: user.id,
          profileIndex: 0,
          name: 'First',
          frequencyHz: 7100000,
          mode: 'USB',
        },
      });

      // Try to create another with same profileIndex.
      const response = await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          stationId: user.id,
          profileIndex: 0,
          name: 'Duplicate',
          frequencyHz: 14200000,
          mode: 'USB',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should allow admin to create profiles', async () => {
      const user = await createTestUser('admin');

      const response = await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          stationId: user.id,
          profileIndex: 5,
          name: 'Admin Profile',
          frequencyHz: 28000000,
          mode: 'FM',
        },
      });

      expect(response.statusCode).toBe(201);
      const profile = response.json<ProfileResponse>();
      expect(profile.name).toBe('Admin Profile');
    });

    it('should reject missing required fields', async () => {
      const user = await createTestUser('operator');

      const response = await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          stationId: user.id,
          // Missing profileIndex, name, frequencyHz, mode
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid mode', async () => {
      const user = await createTestUser('operator');

      const response = await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          stationId: user.id,
          profileIndex: 1,
          name: 'Bad Mode',
          frequencyHz: 7100000,
          mode: 'INVALID_MODE',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject frequency out of range', async () => {
      const user = await createTestUser('operator');

      const response = await app.inject({
        method: 'POST',
        url: '/radio/profiles',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          stationId: user.id,
          profileIndex: 1,
          name: 'Bad Freq',
          frequencyHz: 99_999, // below minimum 100 kHz
          mode: 'USB',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // -- GET /radio/profiles/:id ---------------------------------------

  describe('GET /radio/profiles/:id', () => {
    it('should return 404 for non-existent profile', async () => {
      const user = await createTestUser('user');

      const response = await app.inject({
        method: 'GET',
        url: '/radio/profiles/non-existent-id',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/radio/profiles/some-id',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return a specific profile by ID', async () => {
      const user = await createTestUser('user');
      const now = new Date().toISOString();

      adapter.db.run(
        `INSERT INTO radio_profiles (id, station_id, profile_index, name, frequency_hz, mode, volume, bfo_hz, digital_voice, is_active, created_at, updated_at)
         VALUES ('profile-by-id', '${user.id}', 0, 'By ID', 14200000, 'USB', 50, 0, 0, 0, '${now}', '${now}')`,
      );

      const response = await app.inject({
        method: 'GET',
        url: '/radio/profiles/profile-by-id',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const profile = response.json<ProfileResponse>();
      expect(profile.id).toBe('profile-by-id');
      expect(profile.name).toBe('By ID');
      expect(profile.frequencyHz).toBe(14200000);
    });
  });

  // -- PATCH /radio/profiles/:id -------------------------------------

  describe('PATCH /radio/profiles/:id', () => {
    it('should return 403 for non-operator user', async () => {
      const user = await createTestUser('user');

      const response = await app.inject({
        method: 'PATCH',
        url: '/radio/profiles/some-id',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update a profile name', async () => {
      const user = await createTestUser('operator');
      const now = new Date().toISOString();

      adapter.db.run(
        `INSERT INTO radio_profiles (id, station_id, profile_index, name, frequency_hz, mode, volume, bfo_hz, digital_voice, is_active, created_at, updated_at)
         VALUES ('patch-test', '${user.id}', 0, 'Original Name', 7100000, 'USB', 50, 0, 0, 0, '${now}', '${now}')`,
      );

      const response = await app.inject({
        method: 'PATCH',
        url: '/radio/profiles/patch-test',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const profile = response.json<ProfileResponse>();
      expect(profile.name).toBe('Updated Name');
      // updatedAt should have changed.
      expect(profile.updatedAt).not.toBe(now);
    });

    it('should update multiple fields', async () => {
      const user = await createTestUser('operator');
      const now = new Date().toISOString();

      adapter.db.run(
        `INSERT INTO radio_profiles (id, station_id, profile_index, name, frequency_hz, mode, volume, bfo_hz, digital_voice, is_active, created_at, updated_at)
         VALUES ('multi-update', '${user.id}', 0, 'Multi', 7100000, 'USB', 50, 0, 0, 0, '${now}', '${now}')`,
      );

      const response = await app.inject({
        method: 'PATCH',
        url: '/radio/profiles/multi-update',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          frequencyHz: 14200000,
          mode: 'CW',
          volume: 30,
        },
      });

      expect(response.statusCode).toBe(200);
      const profile = response.json<ProfileResponse>();
      expect(profile.frequencyHz).toBe(14200000);
      expect(profile.mode).toBe('CW');
      expect(profile.volume).toBe(30);
      // Unchanged fields preserved.
      expect(profile.name).toBe('Multi');
    });

    it('should return 404 when updating non-existent profile', async () => {
      const user = await createTestUser('operator');

      const response = await app.inject({
        method: 'PATCH',
        url: '/radio/profiles/non-existent',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { name: 'Nope' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject invalid mode on update', async () => {
      const user = await createTestUser('operator');

      const response = await app.inject({
        method: 'PATCH',
        url: '/radio/profiles/some-id',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { mode: 'INVALID' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty body on update', async () => {
      const user = await createTestUser('operator');

      const response = await app.inject({
        method: 'PATCH',
        url: '/radio/profiles/some-id',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // -- DELETE /radio/profiles/:id ------------------------------------

  describe('DELETE /radio/profiles/:id', () => {
    it('should return 403 for non-operator user', async () => {
      const user = await createTestUser('user');

      const response = await app.inject({
        method: 'DELETE',
        url: '/radio/profiles/some-id',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should delete a profile', async () => {
      const user = await createTestUser('operator');
      const now = new Date().toISOString();

      adapter.db.run(
        `INSERT INTO radio_profiles (id, station_id, profile_index, name, frequency_hz, mode, volume, bfo_hz, digital_voice, is_active, created_at, updated_at)
         VALUES ('delete-me', '${user.id}', 99, 'To Delete', 7100000, 'USB', 50, 0, 0, 0, '${now}', '${now}')`,
      );

      const response = await app.inject({
        method: 'DELETE',
        url: '/radio/profiles/delete-me',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ deleted: boolean }>();
      expect(body.deleted).toBe(true);

      // Verify it's gone.
      const getResponse = await app.inject({
        method: 'GET',
        url: '/radio/profiles/delete-me',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 when deleting non-existent profile', async () => {
      const user = await createTestUser('operator');

      const response = await app.inject({
        method: 'DELETE',
        url: '/radio/profiles/non-existent',
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});