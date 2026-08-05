import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { ConversationParticipantsRepository } from '../../../src/db/repositories/conversation-participants.repository.js';
import type { ConversationParticipantRow } from '../../../src/db/repositories/conversation-participants.repository.js';

let adapter: SQLiteAdapter;
let repo: ConversationParticipantsRepository;

function createTestParticipant(
  overrides?: Partial<Omit<ConversationParticipantRow, 'id'>>,
): Omit<ConversationParticipantRow, 'id'> {
  const now = new Date().toISOString();
  return {
    conversationId: 'conv-id-1',
    userId: 'user-id-1',
    role: 'member',
    lastReadMessageId: null,
    lastReadAt: null,
    mutedUntil: null,
    joinedAt: now,
    leftAt: null,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');

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
  adapter.db.run(
    'CREATE INDEX IF NOT EXISTS idx_conv_participants_conversation ON conversation_participants (conversation_id)',
  );
  adapter.db.run(
    'CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants (user_id)',
  );

  repo = new ConversationParticipantsRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('ConversationParticipantsRepository', () => {
  describe('create', () => {
    it('should create a participant and return it with an id', async () => {
      const input = createTestParticipant();
      const result = await repo.create(input);

      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.conversationId).toBe('conv-id-1');
      expect(result.userId).toBe('user-id-1');
      expect(result.role).toBe('member');
      expect(result.leftAt).toBeNull();
    });

    it('should create a participant with owner role', async () => {
      const input = createTestParticipant({ role: 'owner' });
      const result = await repo.create(input);

      expect(result.role).toBe('owner');
    });

    it('should create a participant with admin role', async () => {
      const input = createTestParticipant({ role: 'admin' });
      const result = await repo.create(input);

      expect(result.role).toBe('admin');
    });
  });

  describe('findById', () => {
    it('should find a participant by id', async () => {
      const created = await repo.create(createTestParticipant());
      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for a non-existent id', async () => {
      const found = await repo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByConversationAndUser', () => {
    it('should find a participant by conversation and user', async () => {
      await repo.create(
        createTestParticipant({ conversationId: 'conv-a', userId: 'user-x' }),
      );

      const found = await repo.findByConversationAndUser('conv-a', 'user-x');
      expect(found).not.toBeNull();
      expect(found!.conversationId).toBe('conv-a');
      expect(found!.userId).toBe('user-x');
    });

    it('should return null when no match', async () => {
      const found = await repo.findByConversationAndUser('no-conv', 'no-user');
      expect(found).toBeNull();
    });
  });

  describe('listByConversationId', () => {
    it('should list all participants in a conversation', async () => {
      await repo.create(createTestParticipant({ conversationId: 'conv-x', userId: 'u1' }));
      await repo.create(createTestParticipant({ conversationId: 'conv-x', userId: 'u2' }));
      await repo.create(createTestParticipant({ conversationId: 'conv-y', userId: 'u3' }));

      const convX = await repo.listByConversationId('conv-x');
      expect(convX.length).toBe(2);
      const userIds = convX.map((p) => p.userId);
      expect(userIds).toContain('u1');
      expect(userIds).toContain('u2');
      expect(userIds).not.toContain('u3');
    });

    it('should return empty array for conversation with no participants', async () => {
      const results = await repo.listByConversationId('empty-conv');
      expect(results).toEqual([]);
    });
  });

  describe('listActiveByUserId', () => {
    it('should list only active (not left) participants for a user', async () => {
      const active = await repo.create(createTestParticipant({ userId: 'active-user' }));
      const left = await repo.create(createTestParticipant({ userId: 'active-user' }));
      await repo.remove(left.id); // soft-remove

      const results = await repo.listActiveByUserId('active-user');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(active.id);
    });

    it('should return empty array for user with no active participants', async () => {
      const results = await repo.listActiveByUserId('no-participant-user');
      expect(results).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update participant role', async () => {
      const created = await repo.create(createTestParticipant({ role: 'member' }));
      const updated = await repo.update(created.id, { role: 'admin' });

      expect(updated).not.toBeNull();
      expect(updated!.role).toBe('admin');
    });

    it('should update lastReadMessageId', async () => {
      const created = await repo.create(createTestParticipant());
      const updated = await repo.update(created.id, { lastReadMessageId: 'msg-123' });

      expect(updated).not.toBeNull();
      expect(updated!.lastReadMessageId).toBe('msg-123');
    });

    it('should return null when updating non-existent participant', async () => {
      const result = await repo.update('non-existent', { role: 'owner' });
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should soft-remove a participant by setting leftAt', async () => {
      const created = await repo.create(createTestParticipant());
      const result = await repo.remove(created.id);

      expect(result).toBe(true);

      const updated = await repo.findById(created.id);
      expect(updated).not.toBeNull();
      expect(updated!.leftAt).not.toBeNull();

      // Should no longer appear in active list
      const active = await repo.listActiveByUserId(created.userId);
      expect(active.find((p) => p.id === created.id)).toBeUndefined();
    });

    it('should return false for non-existent participant', async () => {
      const result = await repo.remove('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should hard-delete a participant', async () => {
      const created = await repo.create(createTestParticipant());
      const result = await repo.delete(created.id);

      expect(result).toBe(true);

      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent participant', async () => {
      const result = await repo.delete('non-existent');
      expect(result).toBe(false);
    });
  });
});