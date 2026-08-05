import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { FrequenciesRepository } from '../../../src/db/repositories/frequencies.repository.js';
import type { FrequencyRow } from '../../../src/db/repositories/frequencies.repository.js';

let adapter: SQLiteAdapter;
let repo: FrequenciesRepository;

function createTestFrequency(overrides?: Partial<Omit<FrequencyRow, 'id'>>): Omit<FrequencyRow, 'id'> {
  const now = new Date().toISOString();
  return {
    alias: 'test-freq',
    frequencyHz: 14200000,
    mode: 'USB',
    description: null,
    isGateway: 0,
    region: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');
  adapter.db.run(`
    CREATE TABLE frequencies (
      id TEXT PRIMARY KEY NOT NULL,
      alias TEXT NOT NULL UNIQUE,
      frequency_hz INTEGER NOT NULL,
      mode TEXT DEFAULT 'USB' NOT NULL CHECK(mode IN ('USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL')),
      description TEXT,
      is_gateway INTEGER DEFAULT 0 NOT NULL,
      region TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  repo = new FrequenciesRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('FrequenciesRepository', () => {
  describe('create', () => {
    it('should create a frequency with an alias', async () => {
      const input = createTestFrequency({ alias: 'test-alias' });
      const result = await repo.create(input);
      expect(result.id).toBeDefined();
      expect(result.alias).toBe('test-alias');
      expect(result.frequencyHz).toBe(14200000);
    });

    it('should create a gateway frequency', async () => {
      const input = createTestFrequency({ alias: 'gateway-freq', isGateway: 1 });
      const result = await repo.create(input);
      expect(result.isGateway).toBe(1);
    });
  });

  describe('findById', () => {
    it('should find a frequency by id', async () => {
      const created = await repo.create(createTestFrequency({ alias: 'by-id' }));
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.alias).toBe('by-id');
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.findById('none')).toBeNull();
    });
  });

  describe('findByAlias', () => {
    it('should find a frequency by alias', async () => {
      await repo.create(createTestFrequency({ alias: 'unique-alias' }));
      const found = await repo.findByAlias('unique-alias');
      expect(found).not.toBeNull();
      expect(found!.alias).toBe('unique-alias');
    });

    it('should return null for unknown alias', async () => {
      expect(await repo.findByAlias('unknown')).toBeNull();
    });
  });

  describe('listAll', () => {
    it('should list all frequencies', async () => {
      await repo.create(createTestFrequency({ alias: 'a' }));
      await repo.create(createTestFrequency({ alias: 'b' }));
      const all = await repo.listAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('update', () => {
    it('should update frequency mode', async () => {
      const created = await repo.create(createTestFrequency({ alias: 'update-test' }));
      const updated = await repo.update(created.id, { mode: 'FM' });
      expect(updated).not.toBeNull();
      expect(updated!.mode).toBe('FM');
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.update('none', { mode: 'AM' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a frequency', async () => {
      const created = await repo.create(createTestFrequency({ alias: 'del-me' }));
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      expect(await repo.delete('none')).toBe(false);
    });
  });
});