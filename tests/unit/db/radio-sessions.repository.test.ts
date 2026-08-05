import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { RadioSessionsRepository } from '../../../src/db/repositories/radio-sessions.repository.js';
import type { RadioSessionRow } from '../../../src/db/repositories/radio-sessions.repository.js';

let adapter: SQLiteAdapter;
let repo: RadioSessionsRepository;

function createTestSession(overrides?: Partial<Omit<RadioSessionRow, 'id'>>): Omit<RadioSessionRow, 'id'> {
  const now = new Date().toISOString();
  return {
    stationId: 'station-1',
    profileId: null,
    startedAt: now,
    endedAt: null,
    bytesTx: 0,
    bytesRx: 0,
    metadata: '{}',
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');
  adapter.db.run(`
    CREATE TABLE radio_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      station_id TEXT NOT NULL,
      profile_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      bytes_tx INTEGER DEFAULT 0 NOT NULL,
      bytes_rx INTEGER DEFAULT 0 NOT NULL,
      metadata TEXT DEFAULT '{}' NOT NULL
    )
  `);
  repo = new RadioSessionsRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('RadioSessionsRepository', () => {
  describe('create', () => {
    it('should create a radio session', async () => {
      const input = createTestSession();
      const result = await repo.create(input);
      expect(result.id).toBeDefined();
      expect(result.stationId).toBe('station-1');
      expect(result.endedAt).toBeNull();
    });

    it('should create a session with initial byte counts', async () => {
      const input = createTestSession({ bytesTx: 1024, bytesRx: 2048 });
      const result = await repo.create(input);
      expect(result.bytesTx).toBe(1024);
      expect(result.bytesRx).toBe(2048);
    });
  });

  describe('findById', () => {
    it('should find a session by id', async () => {
      const created = await repo.create(createTestSession());
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.findById('none')).toBeNull();
    });
  });

  describe('update', () => {
    it('should update byte counts', async () => {
      const created = await repo.create(createTestSession());
      const updated = await repo.update(created.id, { bytesTx: 5000, bytesRx: 3000 });
      expect(updated).not.toBeNull();
      expect(updated!.bytesTx).toBe(5000);
      expect(updated!.bytesRx).toBe(3000);
    });

    it('should end a session', async () => {
      const created = await repo.create(createTestSession());
      const endedAt = new Date().toISOString();
      const updated = await repo.update(created.id, { endedAt });
      expect(updated).not.toBeNull();
      expect(updated!.endedAt).toBe(endedAt);
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.update('none', { bytesTx: 100 })).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a session', async () => {
      const created = await repo.create(createTestSession());
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      expect(await repo.delete('none')).toBe(false);
    });
  });
});