import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { UserDevicesRepository } from '../../../src/db/repositories/user-devices.repository.js';
import type { UserDeviceRow } from '../../../src/db/repositories/user-devices.repository.js';

let adapter: SQLiteAdapter;
let repo: UserDevicesRepository;

function createTestDevice(overrides?: Partial<Omit<UserDeviceRow, 'id'>>): Omit<UserDeviceRow, 'id'> {
  const now = new Date().toISOString();
  return {
    userId: 'user-1',
    deviceName: 'Test Device',
    deviceType: 'mobile',
    pushToken: null,
    platform: null,
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');
  adapter.db.run(`
    CREATE TABLE user_devices (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL CHECK(device_type IN ('mobile', 'desktop', 'station', 'browser')),
      push_token TEXT,
      platform TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices (user_id)');
  repo = new UserDevicesRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('UserDevicesRepository', () => {
  describe('create', () => {
    it('should create a device', async () => {
      const input = createTestDevice({ deviceName: 'My Phone', deviceType: 'mobile' });
      const result = await repo.create(input);
      expect(result.id).toBeDefined();
      expect(result.deviceName).toBe('My Phone');
      expect(result.deviceType).toBe('mobile');
    });

    it('should create a desktop device', async () => {
      const input = createTestDevice({ deviceName: 'Desktop', deviceType: 'desktop' });
      const result = await repo.create(input);
      expect(result.deviceType).toBe('desktop');
    });

    it('should create a station device', async () => {
      const input = createTestDevice({ deviceName: 'sBitx v2', deviceType: 'station', pushToken: 'token-xyz' });
      const result = await repo.create(input);
      expect(result.deviceType).toBe('station');
      expect(result.pushToken).toBe('token-xyz');
    });
  });

  describe('findById', () => {
    it('should find a device by id', async () => {
      const created = await repo.create(createTestDevice());
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.findById('none')).toBeNull();
    });
  });

  describe('listByUserId', () => {
    it('should list devices for a user', async () => {
      await repo.create(createTestDevice({ userId: 'u1', deviceName: 'Phone' }));
      await repo.create(createTestDevice({ userId: 'u1', deviceName: 'Desktop' }));
      await repo.create(createTestDevice({ userId: 'u2', deviceName: 'Tablet' }));

      const u1Devices = await repo.listByUserId('u1');
      expect(u1Devices.length).toBe(2);
      const names = u1Devices.map((d) => d.deviceName);
      expect(names).toContain('Phone');
      expect(names).toContain('Desktop');
      expect(names).not.toContain('Tablet');
    });

    it('should return empty array for user with no devices', async () => {
      expect(await repo.listByUserId('no-devices')).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update lastSeenAt', async () => {
      const created = await repo.create(createTestDevice());
      const now = new Date().toISOString();
      const updated = await repo.update(created.id, { lastSeenAt: now });
      expect(updated).not.toBeNull();
      expect(updated!.lastSeenAt).toBe(now);
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.update('none', { deviceName: 'X' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a device', async () => {
      const created = await repo.create(createTestDevice());
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      expect(await repo.delete('none')).toBe(false);
    });
  });
});