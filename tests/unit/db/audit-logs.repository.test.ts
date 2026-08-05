import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { AuditLogsRepository } from '../../../src/db/repositories/audit-logs.repository.js';
import type { AuditLogRow } from '../../../src/db/repositories/audit-logs.repository.js';

let adapter: SQLiteAdapter;
let repo: AuditLogsRepository;

function createTestLog(overrides?: Partial<Omit<AuditLogRow, 'id'>>): Omit<AuditLogRow, 'id'> {
  const now = new Date().toISOString();
  return {
    actorId: 'actor-1',
    action: 'user.created',
    entityType: 'users',
    entityId: 'entity-1',
    oldValue: null,
    newValue: '{"callsign":"test"}',
    ipAddress: null,
    userAgent: null,
    metadata: '{}',
    locale: 'en',
    createdAt: now,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');
  adapter.db.run(`
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT DEFAULT '{}' NOT NULL,
      locale TEXT DEFAULT 'en' NOT NULL CHECK(locale IN ('en', 'es', 'pt-BR')),
      created_at TEXT NOT NULL
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_id, created_at)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id, created_at)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at)');
  repo = new AuditLogsRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('AuditLogsRepository', () => {
  describe('create', () => {
    it('should create an audit log entry (append-only)', async () => {
      const input = createTestLog({ action: 'user.created', newValue: '{"callsign":"AB1CD"}' });
      const result = await repo.create(input);
      expect(result.id).toBeDefined();
      expect(result.action).toBe('user.created');
      expect(result.entityType).toBe('users');
      expect(result.locale).toBe('en');
    });
  });

  describe('listByEntity', () => {
    it('should list logs for a specific entity', async () => {
      await repo.create(createTestLog({ entityType: 'users', entityId: 'user-1', action: 'user.created' }));
      await repo.create(createTestLog({ entityType: 'users', entityId: 'user-1', action: 'user.updated' }));
      await repo.create(createTestLog({ entityType: 'users', entityId: 'user-2', action: 'user.created' }));

      const logs = await repo.listByEntity('users', 'user-1', 10);
      expect(logs.length).toBe(2);
    });

    it('should respect limit', async () => {
      await repo.create(createTestLog({ entityType: 'msg', entityId: 'msg-1', action: 'msg.created' }));
      await repo.create(createTestLog({ entityType: 'msg', entityId: 'msg-1', action: 'msg.updated' }));

      const logs = await repo.listByEntity('msg', 'msg-1', 1);
      expect(logs.length).toBe(1);
    });
  });

  describe('listByActor', () => {
    it('should list logs by actor', async () => {
      await repo.create(createTestLog({ actorId: 'admin-1', action: 'user.deleted' }));
      await repo.create(createTestLog({ actorId: 'admin-1', action: 'user.created' }));
      await repo.create(createTestLog({ actorId: 'admin-2', action: 'user.created' }));

      const logs = await repo.listByActor('admin-1', 10);
      expect(logs.length).toBe(2);
    });

    it('should respect limit', async () => {
      await repo.create(createTestLog({ actorId: 'actor-x', action: 'a' }));
      await repo.create(createTestLog({ actorId: 'actor-x', action: 'b' }));

      const logs = await repo.listByActor('actor-x', 1);
      expect(logs.length).toBe(1);
    });
  });
});