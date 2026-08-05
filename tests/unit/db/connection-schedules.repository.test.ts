import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { ConnectionSchedulesRepository } from '../../../src/db/repositories/connection-schedules.repository.js';
import type { ConnectionScheduleRow } from '../../../src/db/repositories/connection-schedules.repository.js';

let adapter: SQLiteAdapter;
let repo: ConnectionSchedulesRepository;

function createTestSchedule(overrides?: Partial<Omit<ConnectionScheduleRow, 'id'>>): Omit<ConnectionScheduleRow, 'id'> {
  const now = new Date().toISOString();
  return {
    targetCallsign: 'XX1XXX',
    frequencyId: null,
    scheduledAt: now,
    recurrence: null,
    status: 'pending',
    lastRunAt: null,
    nextRunAt: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');
  adapter.db.run(`
    CREATE TABLE connection_schedules (
      id TEXT PRIMARY KEY NOT NULL,
      target_callsign TEXT NOT NULL,
      frequency_id TEXT,
      scheduled_at TEXT NOT NULL,
      recurrence TEXT,
      status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
      last_run_at TEXT,
      next_run_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  repo = new ConnectionSchedulesRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('ConnectionSchedulesRepository', () => {
  describe('create', () => {
    it('should create a schedule', async () => {
      const input = createTestSchedule({ targetCallsign: 'AB1CD' });
      const result = await repo.create(input);
      expect(result.id).toBeDefined();
      expect(result.targetCallsign).toBe('AB1CD');
      expect(result.status).toBe('pending');
    });
  });

  describe('findById', () => {
    it('should find a schedule by id', async () => {
      const created = await repo.create(createTestSchedule());
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.findById('none')).toBeNull();
    });
  });

  describe('listAll', () => {
    it('should list all schedules', async () => {
      await repo.create(createTestSchedule({ targetCallsign: 'A1' }));
      await repo.create(createTestSchedule({ targetCallsign: 'B2' }));
      const all = await repo.listAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('update', () => {
    it('should update schedule status', async () => {
      const created = await repo.create(createTestSchedule());
      const updated = await repo.update(created.id, { status: 'running' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('running');
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.update('none', { status: 'completed' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a schedule', async () => {
      const created = await repo.create(createTestSchedule());
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      expect(await repo.delete('none')).toBe(false);
    });
  });
});