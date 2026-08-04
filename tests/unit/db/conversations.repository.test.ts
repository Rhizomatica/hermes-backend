import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { ConversationsRepository } from '../../../src/db/repositories/conversations.repository.js';
import type { ConversationRow } from '../../../src/db/repositories/conversations.repository.js';

let adapter: SQLiteAdapter;
let repo: ConversationsRepository;

function createTestConversation(overrides?: Partial<Omit<ConversationRow, 'id'>>): Omit<ConversationRow, 'id'> {
  const now = new Date().toISOString();
  return {
    type: 'group',
    title: 'Test Conversation',
    description: null,
    avatarPath: null,
    createdBy: 'user-id-1',
    lastActivityAt: now,
    archivedAt: null,
    metadata: '{}',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');

  // Disable foreign_keys for unit tests — repositories test CRUD operations
  // in isolation. FK integrity is verified in integration tests.
  adapter.db.run('PRAGMA foreign_keys = OFF');

  // Create users table (needed to match schema shape)
  adapter.db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      callsign TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'user' NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      avatar_path TEXT,
      metadata TEXT DEFAULT '{}' NOT NULL,
      locale TEXT DEFAULT 'en' NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT
    )
  `);

  adapter.db.run(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('direct', 'group', 'broadcast', 'radio')),
      title TEXT,
      description TEXT,
      avatar_path TEXT,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      last_activity_at TEXT,
      archived_at TEXT,
      metadata TEXT DEFAULT '{}' NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations (type)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations (last_activity_at)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations (created_by)');

  repo = new ConversationsRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('ConversationsRepository', () => {
  describe('create', () => {
    it('should create a conversation and return it with an id', async () => {
      const input = createTestConversation();
      const result = await repo.create(input);

      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.type).toBe('group');
      expect(result.title).toBe('Test Conversation');
      expect(result.createdBy).toBe('user-id-1');
      expect(result.metadata).toBe('{}');
    });

    it('should create a direct conversation without a title', async () => {
      const input = createTestConversation({ type: 'direct', title: null });
      const result = await repo.create(input);

      expect(result.type).toBe('direct');
      expect(result.title).toBeNull();
    });

    it('should create a broadcast conversation', async () => {
      const input = createTestConversation({ type: 'broadcast' });
      const result = await repo.create(input);

      expect(result.type).toBe('broadcast');
    });

    it('should create a radio conversation', async () => {
      const input = createTestConversation({ type: 'radio' });
      const result = await repo.create(input);

      expect(result.type).toBe('radio');
    });

    it('should store metadata as JSON string', async () => {
      const input = createTestConversation({
        metadata: JSON.stringify({ frequency: '14200' }),
      });
      const result = await repo.create(input);

      expect(result.metadata).toBe('{"frequency":"14200"}');
    });
  });

  describe('findById', () => {
    it('should find a conversation by id', async () => {
      const created = await repo.create(createTestConversation({ title: 'Find Me' }));
      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe('Find Me');
    });

    it('should return null for a non-existent id', async () => {
      const found = await repo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('listByUserId', () => {
    it('should list conversations created by a user', async () => {
      await repo.create(createTestConversation({ createdBy: 'user-a', title: 'Conversation A' }));
      await repo.create(createTestConversation({ createdBy: 'user-a', title: 'Conversation B' }));
      await repo.create(createTestConversation({ createdBy: 'user-b', title: 'Conversation C' }));

      const userAConvs = await repo.listByUserId('user-a');
      expect(userAConvs.length).toBe(2);
      const titles = userAConvs.map((c) => c.title);
      expect(titles).toContain('Conversation A');
      expect(titles).toContain('Conversation B');
      expect(titles).not.toContain('Conversation C');
    });

    it('should respect limit and offset', async () => {
      await repo.create(createTestConversation({ createdBy: 'user-pag', title: 'First' }));
      await repo.create(createTestConversation({ createdBy: 'user-pag', title: 'Second' }));
      await repo.create(createTestConversation({ createdBy: 'user-pag', title: 'Third' }));

      const page1 = await repo.listByUserId('user-pag', { limit: 2, offset: 0 });
      expect(page1.length).toBe(2);

      const page2 = await repo.listByUserId('user-pag', { limit: 2, offset: 2 });
      expect(page2.length).toBe(1);
    });

    it('should return empty array for user with no conversations', async () => {
      const results = await repo.listByUserId('no-conversations-user');
      expect(results).toEqual([]);
    });
  });

  describe('listAll', () => {
    it('should return all conversations ordered by lastActivityAt desc', async () => {
      const now = new Date().toISOString();
      const earlier = new Date(Date.now() - 3600000).toISOString();

      await repo.create(createTestConversation({ title: 'Older', lastActivityAt: earlier }));
      await repo.create(createTestConversation({ title: 'Newer', lastActivityAt: now }));

      const all = await repo.listAll();
      expect(all.length).toBeGreaterThanOrEqual(2);

      // The newer one should come first (desc order)
      const newerIndex = all.findIndex((c) => c.title === 'Newer');
      const olderIndex = all.findIndex((c) => c.title === 'Older');
      expect(newerIndex).toBeLessThan(olderIndex);
    });
  });

  describe('update', () => {
    it('should update a conversation title', async () => {
      const created = await repo.create(createTestConversation({ title: 'Original' }));
      const updated = await repo.update(created.id, { title: 'Updated' });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated');
      expect(updated!.type).toBe('group'); // unchanged
    });

    it('should archive a conversation', async () => {
      const now = new Date().toISOString();
      const created = await repo.create(createTestConversation());
      const updated = await repo.update(created.id, { archivedAt: now });

      expect(updated).not.toBeNull();
      expect(updated!.archivedAt).toBe(now);
    });

    it('should return null when updating non-existent conversation', async () => {
      const result = await repo.update('non-existent', { title: 'Nope' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a conversation and return true', async () => {
      const created = await repo.create(createTestConversation());
      const result = await repo.delete(created.id);

      expect(result).toBe(true);

      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent conversation', async () => {
      const result = await repo.delete('non-existent');
      expect(result).toBe(false);
    });
  });
});