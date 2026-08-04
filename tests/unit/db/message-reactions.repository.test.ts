import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { MessageReactionsRepository } from '../../../src/db/repositories/message-reactions.repository.js';
import type { MessageReactionRow } from '../../../src/db/repositories/message-reactions.repository.js';

let adapter: SQLiteAdapter;
let repo: MessageReactionsRepository;

function createTestReaction(overrides?: Partial<Omit<MessageReactionRow, 'id'>>): Omit<MessageReactionRow, 'id'> {
  return {
    messageId: 'msg-id-1',
    userId: 'user-id-1',
    emoji: '👍',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');

  adapter.db.run(`
    CREATE TABLE message_reactions (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions (message_id)');

  repo = new MessageReactionsRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('MessageReactionsRepository', () => {
  describe('create', () => {
    it('should create a reaction', async () => {
      const result = await repo.create(createTestReaction({ emoji: '❤️' }));
      expect(result.id).toBeDefined();
      expect(result.emoji).toBe('❤️');
      expect(result.messageId).toBe('msg-id-1');
      expect(result.userId).toBe('user-id-1');
    });
  });

  describe('listByMessageId', () => {
    it('should list all reactions for a message', async () => {
      await repo.create(createTestReaction({ messageId: 'msg-x', emoji: '👍', userId: 'u1' }));
      await repo.create(createTestReaction({ messageId: 'msg-x', emoji: '❤️', userId: 'u2' }));
      await repo.create(createTestReaction({ messageId: 'msg-y', emoji: '🎉', userId: 'u3' }));

      const reactions = await repo.listByMessageId('msg-x');
      expect(reactions.length).toBe(2);
      expect(reactions.map((r) => r.emoji)).toEqual(expect.arrayContaining(['👍', '❤️']));
    });

    it('should return empty array for message with no reactions', async () => {
      const results = await repo.listByMessageId('no-reactions');
      expect(results).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete a specific reaction by messageId, userId, emoji', async () => {
      await repo.create(createTestReaction({ messageId: 'msg-del', userId: 'u1', emoji: '👍' }));
      await repo.create(createTestReaction({ messageId: 'msg-del', userId: 'u1', emoji: '❤️' }));

      const result = await repo.delete('msg-del', 'u1', '👍');
      expect(result).toBe(true);

      const remaining = await repo.listByMessageId('msg-del');
      expect(remaining.length).toBe(1);
      expect(remaining[0].emoji).toBe('❤️');
    });

    it('should return false for non-existent reaction', async () => {
      const result = await repo.delete('no-msg', 'no-user', '👍');
      expect(result).toBe(false);
    });
  });
});