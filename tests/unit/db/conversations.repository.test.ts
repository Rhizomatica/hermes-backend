import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { ConversationsRepository } from '../../../src/db/repositories/conversations.repository.js';
import type { ConversationRow, CreateConversationInput } from '../../../src/db/repositories/conversations.repository.js';

let adapter: SQLiteAdapter;
let repo: ConversationsRepository;

function createTestConversation(overrides?: Partial<CreateConversationInput>): CreateConversationInput {
  return {
    type: 'group',
    title: 'Test Conversation',
    description: null,
    avatarPath: null,
    createdBy: 'user-id-1',
    lastActivityAt: null,
    archivedAt: null,
    metadata: '{}',
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

  // Create conversation_participants table for listByParticipant tests
  adapter.db.run(`
    CREATE TABLE conversation_participants (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member' NOT NULL CHECK(role IN ('owner', 'admin', 'member')),
      last_read_message_id TEXT,
      last_read_at TEXT,
      muted_until TEXT,
      joined_at TEXT NOT NULL,
      left_at TEXT
    )
  `);

  repo = new ConversationsRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('ConversationsRepository', () => {
  describe('create', () => {
    it('should create a conversation with auto-generated timestamps', async () => {
      const input = createTestConversation();
      const result = await repo.create(input);

      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.type).toBe('group');
      expect(result.title).toBe('Test Conversation');
      expect(result.createdBy).toBe('user-id-1');
      expect(result.metadata).toBe('{}');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should respect explicit timestamps when provided', async () => {
      const explicitTime = new Date('2025-01-15T12:00:00Z').toISOString();
      const input = createTestConversation({ createdAt: explicitTime, updatedAt: explicitTime });
      const result = await repo.create(input);

      expect(result.createdAt).toBe(explicitTime);
      expect(result.updatedAt).toBe(explicitTime);
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

    it('should store metadata as JSON string and validate it', async () => {
      const input = createTestConversation({
        metadata: JSON.stringify({ frequency: '14200' }),
      });
      const result = await repo.create(input);

      expect(result.metadata).toBe('{"frequency":"14200"}');
    });

    it('should reject invalid JSON metadata', async () => {
      const input = createTestConversation({ metadata: 'not-valid-json' });
      await expect(repo.create(input)).rejects.toThrow('Invalid JSON in conversations.metadata');
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

  describe('listByCreatedBy', () => {
    it('should list conversations created by a user', async () => {
      await repo.create(createTestConversation({ createdBy: 'user-a', title: 'Conversation A' }));
      await repo.create(createTestConversation({ createdBy: 'user-a', title: 'Conversation B' }));
      await repo.create(createTestConversation({ createdBy: 'user-b', title: 'Conversation C' }));

      const userAConvs = await repo.listByCreatedBy('user-a');
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

      const page1 = await repo.listByCreatedBy('user-pag', { limit: 2, offset: 0 });
      expect(page1.length).toBe(2);

      const page2 = await repo.listByCreatedBy('user-pag', { limit: 2, offset: 2 });
      expect(page2.length).toBe(1);
    });

    it('should return empty array for user with no conversations', async () => {
      const results = await repo.listByCreatedBy('no-conversations-user');
      expect(results).toEqual([]);
    });
  });

  describe('listByUserId (deprecated alias)', () => {
    it('should delegate to listByCreatedBy', async () => {
      await repo.create(createTestConversation({ createdBy: 'user-alias', title: 'Alias Test' }));

      const byCreatedBy = await repo.listByCreatedBy('user-alias');
      const byUserId = await repo.listByUserId('user-alias');

      expect(byUserId).toEqual(byCreatedBy);
    });
  });

  describe('listByParticipant', () => {
    function addParticipant(conversationId: string, userId: string, role = 'member') {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      adapter.db.run(
        `INSERT INTO conversation_participants (id, conversation_id, user_id, role, joined_at) VALUES ('${id}', '${conversationId}', '${userId}', '${role}', '${now}')`,
      );
    }

    it('should return conversations where user is a participant (JOIN)', async () => {
      const conv1 = await repo.create(createTestConversation({ createdBy: 'creator-a', title: 'Creator A' }));
      const conv2 = await repo.create(createTestConversation({ createdBy: 'creator-b', title: 'Creator B' }));

      // User 'participant-x' is a participant in conv1 but NOT the creator
      addParticipant(conv1.id, 'participant-x');
      // conv2 has no participants linked to 'participant-x'

      const results = await repo.listByParticipant('participant-x');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(conv1.id);
    });

    it('should exclude conversations where user has left', async () => {
      const conv = await repo.create(createTestConversation({ createdBy: 'creator-c', title: 'Left Conv' }));
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      adapter.db.run(
        `INSERT INTO conversation_participants (id, conversation_id, user_id, role, joined_at, left_at) VALUES ('${id}', '${conv.id}', 'left-user', 'member', '${now}', '${now}')`,
      );

      const results = await repo.listByParticipant('left-user');
      expect(results.length).toBe(0);
    });

    it('should return empty array for user with no participants', async () => {
      const results = await repo.listByParticipant('no-participation-user');
      expect(results).toEqual([]);
    });

    it('should respect limit and offset', async () => {
      const conv1 = await repo.create(createTestConversation({ createdBy: 'creator-d', title: 'P1' }));
      const conv2 = await repo.create(createTestConversation({ createdBy: 'creator-e', title: 'P2' }));
      const conv3 = await repo.create(createTestConversation({ createdBy: 'creator-f', title: 'P3' }));

      addParticipant(conv1.id, 'multi-user');
      addParticipant(conv2.id, 'multi-user');
      addParticipant(conv3.id, 'multi-user');

      const page1 = await repo.listByParticipant('multi-user', { limit: 2, offset: 0 });
      expect(page1.length).toBe(2);

      const page2 = await repo.listByParticipant('multi-user', { limit: 2, offset: 2 });
      expect(page2.length).toBe(1);
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
    it('should update a conversation title and auto-update updatedAt', async () => {
      const created = await repo.create(createTestConversation({ title: 'Original' }));
      await new Promise((r) => setTimeout(r, 10));
      const updated = await repo.update(created.id, { title: 'Updated' });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated');
      expect(updated!.type).toBe('group'); // unchanged
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
    });

    it('should archive a conversation', async () => {
      const now = new Date().toISOString();
      const created = await repo.create(createTestConversation());
      const updated = await repo.update(created.id, { archivedAt: now });

      expect(updated).not.toBeNull();
      expect(updated!.archivedAt).toBe(now);
    });

    it('should reject invalid JSON metadata on update', async () => {
      const created = await repo.create(createTestConversation());
      await expect(repo.update(created.id, { metadata: 'bad-json' })).rejects.toThrow('Invalid JSON in conversations.metadata');
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