import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { RadioProfilesRepository } from '../../../src/db/repositories/radio-profiles.repository.js';
import type { RadioProfileRow } from '../../../src/db/repositories/radio-profiles.repository.js';

let adapter: SQLiteAdapter;
let repo: RadioProfilesRepository;

let stationCounter = 0;

function createTestProfile(overrides?: Partial<Omit<RadioProfileRow, 'id'>>): Omit<RadioProfileRow, 'id'> {
  const now = new Date().toISOString();
  return {
    stationId: `station-${++stationCounter}`,
    profileIndex: 0,
    name: 'Test Profile',
    frequencyHz: 14200000,
    mode: 'USB',
    volume: 50,
    bfoHz: 0,
    digitalVoice: 0,
    powerLevel: null,
    isActive: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');

  adapter.db.run(`
    CREATE TABLE radio_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      station_id TEXT NOT NULL,
      profile_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      frequency_hz INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL')),
      volume INTEGER DEFAULT 50 NOT NULL CHECK(volume BETWEEN 0 AND 100),
      bfo_hz INTEGER DEFAULT 0 NOT NULL,
      digital_voice INTEGER DEFAULT 0 NOT NULL,
      power_level INTEGER,
      is_active INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (station_id, profile_index)
    )
  `);

  repo = new RadioProfilesRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('RadioProfilesRepository', () => {
  describe('create', () => {
    it('should create a radio profile', async () => {
      const input = createTestProfile();
      const result = await repo.create(input);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Profile');
      expect(result.frequencyHz).toBe(14200000);
      expect(result.mode).toBe('USB');
    });

    it('should create multiple profiles for the same station with different indices', async () => {
      const p1 = await repo.create(createTestProfile({ stationId: 's1', profileIndex: 0, name: 'Profile 0' }));
      const p2 = await repo.create(createTestProfile({ stationId: 's1', profileIndex: 1, name: 'Profile 1' }));

      expect(p1.id).not.toBe(p2.id);
      expect(p1.profileIndex).toBe(0);
      expect(p2.profileIndex).toBe(1);
    });
  });

  describe('findById', () => {
    it('should find a profile by id', async () => {
      const created = await repo.create(createTestProfile({ name: 'Find Me' }));
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Find Me');
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.findById('ghost')).toBeNull();
    });
  });

  describe('listByStationId', () => {
    it('should list profiles for a station', async () => {
      await repo.create(createTestProfile({ stationId: 'sX', name: 'A' }));
      await repo.create(createTestProfile({ stationId: 'sX', profileIndex: 1, name: 'B' }));
      await repo.create(createTestProfile({ stationId: 'sY', name: 'C' }));

      const sxProfiles = await repo.listByStationId('sX');
      expect(sxProfiles.length).toBe(2);
      const names = sxProfiles.map((p) => p.name);
      expect(names).toContain('A');
      expect(names).toContain('B');
      expect(names).not.toContain('C');
    });

    it('should return empty array for unknown station', async () => {
      expect(await repo.listByStationId('none')).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update volume within valid range', async () => {
      const created = await repo.create(createTestProfile({ volume: 50 }));
      const updated = await repo.update(created.id, { volume: 75 });
      expect(updated).not.toBeNull();
      expect(updated!.volume).toBe(75);
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.update('none', { name: 'X' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a profile', async () => {
      const created = await repo.create(createTestProfile());
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      expect(await repo.delete('none')).toBe(false);
    });
  });
});