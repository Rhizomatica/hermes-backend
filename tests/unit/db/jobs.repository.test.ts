import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { JobsRepository } from '../../../src/db/repositories/jobs.repository.js';
import type { JobRow } from '../../../src/db/repositories/jobs.repository.js';

let adapter: SQLiteAdapter;
let repo: JobsRepository;

function createTestJob(overrides?: Partial<Omit<JobRow, 'id'>>): Omit<JobRow, 'id'> {
  const now = new Date().toISOString();
  return {
    type: 'email.send',
    payload: '{"to":"test@test.com"}',
    priority: 5,
    status: 'queued',
    maxAttempts: 3,
    attempts: 0,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    error: null,
    createdAt: now,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');
  adapter.db.run(`
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      priority INTEGER DEFAULT 5 NOT NULL CHECK(priority BETWEEN 1 AND 10),
      status TEXT DEFAULT 'queued' NOT NULL CHECK(status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
      max_attempts INTEGER DEFAULT 3 NOT NULL,
      attempts INTEGER DEFAULT 0 NOT NULL,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      failed_at TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    )
  `);
  repo = new JobsRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('JobsRepository', () => {
  describe('create', () => {
    it('should create a queued job', async () => {
      const input = createTestJob({ type: 'email.send', payload: '{"to":"x"}' });
      const result = await repo.create(input);
      expect(result.id).toBeDefined();
      expect(result.type).toBe('email.send');
      expect(result.status).toBe('queued');
      expect(result.priority).toBe(5);
    });

    it('should create a job with high priority', async () => {
      const input = createTestJob({ priority: 10 });
      const result = await repo.create(input);
      expect(result.priority).toBe(10);
    });
  });

  describe('findById', () => {
    it('should find a job by id', async () => {
      const created = await repo.create(createTestJob());
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.findById('none')).toBeNull();
    });
  });

  describe('listQueued', () => {
    it('should list queued jobs ordered by priority desc then created_at', async () => {
      await repo.create(createTestJob({ type: 'low', priority: 3 }));
      await repo.create(createTestJob({ type: 'high', priority: 9 }));

      // Mark one as running so it's excluded
      const started = await repo.create(createTestJob({ type: 'started', priority: 8 }));
      await repo.update(started.id, { status: 'running' });

      const queued = await repo.listQueued(10);
      // At least our 2 queued jobs plus any from earlier tests in the shared DB
      expect(queued.length).toBeGreaterThanOrEqual(2);
      // High priority first among our two jobs
      const ourJobs = queued.filter((j) => j.type === 'low' || j.type === 'high');
      expect(ourJobs.length).toBe(2);
      expect(ourJobs[0].priority).toBeGreaterThanOrEqual(ourJobs[1].priority);
    });

    it('should respect limit', async () => {
      await repo.create(createTestJob({ type: 'j1' }));
      await repo.create(createTestJob({ type: 'j2' }));
      const results = await repo.listQueued(1);
      expect(results.length).toBe(1);
    });
  });

  describe('update', () => {
    it('should update job status', async () => {
      const created = await repo.create(createTestJob());
      const updated = await repo.update(created.id, { status: 'running', startedAt: new Date().toISOString() });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('running');
    });

    it('should update attempts and error', async () => {
      const created = await repo.create(createTestJob());
      const updated = await repo.update(created.id, { attempts: 1, error: 'timeout' });
      expect(updated).not.toBeNull();
      expect(updated!.attempts).toBe(1);
      expect(updated!.error).toBe('timeout');
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.update('none', { status: 'completed' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a job', async () => {
      const created = await repo.create(createTestJob());
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      expect(await repo.delete('none')).toBe(false);
    });
  });
});