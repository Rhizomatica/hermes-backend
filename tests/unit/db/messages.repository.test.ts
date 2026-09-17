import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { MessagesRepository } from '../../../src/db/repositories/messages.repository.js';
import type { CreateMessageInput } from '../../../src/db/repositories/messages.repository.js';

let adapter: SQLiteAdapter;
let repo: MessagesRepository;

function createTestMessage(overrides?: Partial<CreateMessageInput>): CreateMessageInput {
  return {
    conversationId: 'conv-id-1',
    senderId: 'user-id-1',
    clientMessageId: null,
    content: 'Hello, world!',
    contentType: 'text',
    replyToMessageId: null,
    forwardedFromId: null,
    subject: null,
    status: 'sent',
    editedAt: null,
    deletedAt: null,
    metadata: '{}',
    ...overrides,
  };
}

function expectedChecksum(content: string | null): string | null {
  if (content === null) return null;
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');

  adapter.db.run(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      client_message_id TEXT UNIQUE,
      content TEXT,
      content_checksum TEXT,
      content_type TEXT DEFAULT 'text' NOT NULL
        CHECK(content_type IN ('text', 'markdown', 'html', 'audio', 'system', 'attachment_only')),
      reply_to_message_id TEXT,
      forwarded_from_id TEXT,
      subject TEXT,
      status TEXT DEFAULT 'sending' NOT NULL
        CHECK(status IN ('draft', 'sending', 'sent', 'failed')),
      edited_at TEXT,
      deleted_at TEXT,
      metadata TEXT DEFAULT '{}' NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages (client_message_id)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages (reply_to_message_id)');

  repo = new MessagesRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('MessagesRepository', () => {
  describe('create', () => {
    it('should create a message with auto-generated timestamps when not provided', async () => {
      const input = createTestMessage({ content: 'Test content' });
      const result = await repo.create(input);

      expect(result.id).toBeDefined();
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.content).toBe('Test content');
      expect(result.contentChecksum).toBe(expectedChecksum('Test content'));
      expect(result.contentType).toBe('text');
      expect(result.status).toBe('sent');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should respect explicit timestamps when provided', async () => {
      const explicitTime = new Date('2025-01-15T12:00:00Z').toISOString();
      const input = createTestMessage({
        content: 'Explicit time',
        createdAt: explicitTime,
        updatedAt: explicitTime,
      });
      const result = await repo.create(input);

      expect(result.createdAt).toBe(explicitTime);
      expect(result.updatedAt).toBe(explicitTime);
    });

    it('should store null checksum for null content', async () => {
      const input = createTestMessage({ content: null });
      const result = await repo.create(input);

      expect(result.content).toBeNull();
      expect(result.contentChecksum).toBeNull();
    });

    it('should reject invalid JSON metadata', async () => {
      const input = createTestMessage({ metadata: 'not-valid-json' });
      await expect(repo.create(input)).rejects.toThrow('Invalid JSON in messages.metadata');
    });

    it('should create a message with a clientMessageId for idempotency', async () => {
      const input = createTestMessage({ clientMessageId: 'client-uuid-123' });
      const result = await repo.create(input);

      expect(result.clientMessageId).toBe('client-uuid-123');
    });

    it('should create a message with reply_to reference', async () => {
      const parent = await repo.create(createTestMessage({ content: 'Parent' }));
      const reply = await repo.create(
        createTestMessage({
          content: 'Reply',
          replyToMessageId: parent.id,
        }),
      );

      expect(reply.replyToMessageId).toBe(parent.id);
    });

    it('should handle different content types', async () => {
      const markdownMsg = await repo.create(
        createTestMessage({ contentType: 'markdown', content: '**bold**' }),
      );
      expect(markdownMsg.contentType).toBe('markdown');

      const systemMsg = await repo.create(
        createTestMessage({ contentType: 'system', content: 'System message' }),
      );
      expect(systemMsg.contentType).toBe('system');
    });
  });

  describe('findById', () => {
    it('should find a message by id', async () => {
      const created = await repo.create(createTestMessage({ content: 'Find me' }));
      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.content).toBe('Find me');
    });

    it('should return null for a non-existent id', async () => {
      const found = await repo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByClientMessageId', () => {
    it('should find a message by clientMessageId (idempotency)', async () => {
      const input = createTestMessage({ clientMessageId: 'client-abc', content: 'Dedup me' });
      await repo.create(input);

      const found = await repo.findByClientMessageId('client-abc');
      expect(found).not.toBeNull();
      expect(found!.content).toBe('Dedup me');
    });

    it('should return null when clientMessageId not found', async () => {
      const found = await repo.findByClientMessageId('non-existent-client');
      expect(found).toBeNull();
    });
  });

  describe('listByConversationId', () => {
    it('should list messages in a conversation ordered by newest first', async () => {
      const earlier = new Date('2025-01-01T00:00:00Z').toISOString();
      const later = new Date('2025-01-02T00:00:00Z').toISOString();

      await repo.create(createTestMessage({ conversationId: 'conv-list', content: 'Older', createdAt: earlier }));
      await repo.create(createTestMessage({ conversationId: 'conv-list', content: 'Newer', createdAt: later }));

      const { items } = await repo.listByConversationId('conv-list');
      expect(items.length).toBeGreaterThanOrEqual(2);

      // Newest first
      const newerIdx = items.findIndex((m) => m.content === 'Newer');
      const olderIdx = items.findIndex((m) => m.content === 'Older');
      expect(newerIdx).toBeLessThan(olderIdx);
    });

    it('should exclude soft-deleted messages', async () => {
      const msg = await repo.create(createTestMessage({ conversationId: 'conv-del' }));
      await repo.softDelete(msg.id);

      const { items } = await repo.listByConversationId('conv-del');
      expect(items.find((m) => m.id === msg.id)).toBeUndefined();
    });

    it('should respect limit', async () => {
      await repo.create(createTestMessage({ conversationId: 'conv-limit', content: 'M1' }));
      await repo.create(createTestMessage({ conversationId: 'conv-limit', content: 'M2' }));
      await repo.create(createTestMessage({ conversationId: 'conv-limit', content: 'M3' }));

      const { items } = await repo.listByConversationId('conv-limit', { limit: 2 });
      expect(items.length).toBe(2);
    });

    it('should support cursor-based pagination with nextCursor', async () => {
      const t1 = new Date('2025-01-03T00:00:00Z').toISOString();
      const t2 = new Date('2025-01-02T00:00:00Z').toISOString();
      const t3 = new Date('2025-01-01T00:00:00Z').toISOString();

      await repo.create(createTestMessage({ conversationId: 'conv-cursor', content: 'M1', createdAt: t1 }));
      await repo.create(createTestMessage({ conversationId: 'conv-cursor', content: 'M2', createdAt: t2 }));
      await repo.create(createTestMessage({ conversationId: 'conv-cursor', content: 'M3', createdAt: t3 }));

      // Using cursor = t2, should only get messages created before t2 (i.e., M3)
      const { items, nextCursor } = await repo.listByConversationId('conv-cursor', {
        limit: 10,
        cursor: t2,
      });
      const contents = items.map((m) => m.content);
      expect(contents).toContain('M3');
      expect(contents).not.toContain('M1');
      expect(contents).not.toContain('M2');
      // Only one item, so nextCursor should be null
      expect(nextCursor).toBeNull();
    });

    it('should return nextCursor when there are more items', async () => {
      const t1 = new Date('2025-01-03T00:00:00Z').toISOString();
      const t2 = new Date('2025-01-02T00:00:00Z').toISOString();
      const t3 = new Date('2025-01-01T00:00:00Z').toISOString();

      await repo.create(createTestMessage({ conversationId: 'conv-next', content: 'M1', createdAt: t1 }));
      await repo.create(createTestMessage({ conversationId: 'conv-next', content: 'M2', createdAt: t2 }));
      await repo.create(createTestMessage({ conversationId: 'conv-next', content: 'M3', createdAt: t3 }));

      const { items, nextCursor } = await repo.listByConversationId('conv-next', { limit: 2 });

      expect(items.length).toBe(2);
      // There should be a next cursor since we have 3 items with limit 2
      expect(nextCursor).not.toBeNull();
    });

    it('should return empty array for conversation with no messages', async () => {
      const { items } = await repo.listByConversationId('empty-conv');
      expect(items).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update message content and recompute checksum', async () => {
      const created = await repo.create(createTestMessage({ content: 'Original' }));
      const updated = await repo.update(created.id, { content: 'Updated content' });

      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Updated content');
      expect(updated!.contentChecksum).toBe(expectedChecksum('Updated content'));
      expect(updated!.contentChecksum).not.toBe(created.contentChecksum);
    });

    it('should auto-update updatedAt on modification', async () => {
      const created = await repo.create(createTestMessage({ content: 'Original' }));
      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 10));
      const updated = await repo.update(created.id, { content: 'Updated content' });

      expect(updated).not.toBeNull();
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
    });

    it('should update message status', async () => {
      const created = await repo.create(createTestMessage({ status: 'draft' }));
      const updated = await repo.update(created.id, { status: 'sent' });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('sent');
    });

    it('should reject invalid JSON metadata on update', async () => {
      const created = await repo.create(createTestMessage());
      await expect(repo.update(created.id, { metadata: 'bad-json' })).rejects.toThrow('Invalid JSON in messages.metadata');
    });

    it('should accept valid JSON metadata on update', async () => {
      const created = await repo.create(createTestMessage());
      const updated = await repo.update(created.id, { metadata: '{"key":"value"}' });
      expect(updated).not.toBeNull();
      expect(updated!.metadata).toBe('{"key":"value"}');
    });

    it('should return null when updating non-existent message', async () => {
      const result = await repo.update('non-existent', { content: 'Nope' });
      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt but preserve content', async () => {
      const created = await repo.create(createTestMessage({ content: 'To delete' }));
      const result = await repo.softDelete(created.id);

      expect(result).toBe(true);

      const updated = await repo.findById(created.id);
      expect(updated).not.toBeNull();
      expect(updated!.deletedAt).not.toBeNull();
      // Content is PRESERVED (not nullified) for compliance
      expect(updated!.content).toBe('To delete');
    });

    it('should return false when message is already deleted', async () => {
      const created = await repo.create(createTestMessage());
      await repo.softDelete(created.id);
      const secondDelete = await repo.softDelete(created.id);
      expect(secondDelete).toBe(false);
    });

    it('should return false for non-existent message', async () => {
      const result = await repo.softDelete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('purgeExpiredContent', () => {
    it('should nullify content for messages deleted before the cut-off date', async () => {
      const msg1 = await repo.create(createTestMessage({ content: 'Purge me 1' }));
      const msg2 = await repo.create(createTestMessage({ content: 'Purge me 2' }));

      // Soft-delete both
      await repo.softDelete(msg1.id);
      await repo.softDelete(msg2.id);

      // Purge content deleted before a future timestamp (covers both)
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const purged = await repo.purgeExpiredContent(futureDate);
      expect(purged).toBeGreaterThanOrEqual(2);

      const updated1 = await repo.findById(msg1.id);
      const updated2 = await repo.findById(msg2.id);
      expect(updated1!.content).toBeNull();
      expect(updated1!.contentChecksum).toBeNull();
      expect(updated2!.content).toBeNull();
      expect(updated2!.contentChecksum).toBeNull();
    });

    it('should not purge content from non-deleted messages', async () => {
      const msg = await repo.create(createTestMessage({ content: 'Keep me' }));

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const purged = await repo.purgeExpiredContent(futureDate);
      expect(purged).toBe(0); // no soft-deleted messages

      const found = await repo.findById(msg.id);
      expect(found!.content).toBe('Keep me');
    });

    it('should not re-purge already purged content', async () => {
      const msg = await repo.create(createTestMessage({ content: 'Purge once' }));
      await repo.softDelete(msg.id);

      // First purge
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const purged1 = await repo.purgeExpiredContent(futureDate);
      expect(purged1).toBe(1);

      // Second purge should not count the same message (content is already null)
      const purged2 = await repo.purgeExpiredContent(futureDate);
      expect(purged2).toBe(0);
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a message', async () => {
      const created = await repo.create(createTestMessage());
      const result = await repo.hardDelete(created.id);

      expect(result).toBe(true);

      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent message', async () => {
      const result = await repo.hardDelete('non-existent');
      expect(result).toBe(false);
    });
  });
});