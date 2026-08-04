import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { MessageDeliveriesRepository } from '../../../src/db/repositories/message-deliveries.repository.js';
import type { MessageDeliveryRow } from '../../../src/db/repositories/message-deliveries.repository.js';

let adapter: SQLiteAdapter;
let repo: MessageDeliveriesRepository;

function createTestDelivery(overrides?: Partial<Omit<MessageDeliveryRow, 'id'>>): Omit<MessageDeliveryRow, 'id'> {
  return {
    messageId: 'msg-id-1',
    recipientId: 'recipient-id-1',
    channel: 'websocket',
    status: 'pending',
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    error: null,
    attempts: 0,
    nextRetryAt: null,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');

  adapter.db.run(`
    CREATE TABLE message_deliveries (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('websocket', 'email', 'radio', 'push', 'sms')),
      status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
      sent_at TEXT,
      delivered_at TEXT,
      read_at TEXT,
      failed_at TEXT,
      error TEXT,
      attempts INTEGER DEFAULT 0 NOT NULL,
      next_retry_at TEXT
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_deliveries_message ON message_deliveries (message_id)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_status ON message_deliveries (recipient_id, status)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_deliveries_next_retry ON message_deliveries (next_retry_at)');

  repo = new MessageDeliveriesRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('MessageDeliveriesRepository', () => {
  describe('create', () => {
    it('should create a delivery record', async () => {
      const result = await repo.create(createTestDelivery());
      expect(result.id).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.channel).toBe('websocket');
    });

    it('should create a delivery with different channels', async () => {
      const emailDelivery = await repo.create(createTestDelivery({ channel: 'email' }));
      expect(emailDelivery.channel).toBe('email');

      const radioDelivery = await repo.create(createTestDelivery({ channel: 'radio' }));
      expect(radioDelivery.channel).toBe('radio');
    });
  });

  describe('findById', () => {
    it('should find a delivery by id', async () => {
      const created = await repo.create(createTestDelivery());
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      expect(await repo.findById('nonexistent')).toBeNull();
    });
  });

  describe('listByMessageId', () => {
    it('should list all deliveries for a message', async () => {
      await repo.create(createTestDelivery({ messageId: 'msg-a' }));
      await repo.create(createTestDelivery({ messageId: 'msg-a', channel: 'email' }));
      await repo.create(createTestDelivery({ messageId: 'msg-b' }));

      const deliveries = await repo.listByMessageId('msg-a');
      expect(deliveries.length).toBe(2);
    });
  });

  describe('listPendingByRecipient', () => {
    it('should list pending deliveries for a recipient', async () => {
      await repo.create(createTestDelivery({ recipientId: 'rec-x', status: 'pending' }));
      await repo.create(createTestDelivery({ recipientId: 'rec-x', status: 'delivered' }));

      const pending = await repo.listPendingByRecipient('rec-x');
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe('pending');
    });
  });

  describe('update', () => {
    it('should update status to delivered', async () => {
      const created = await repo.create(createTestDelivery());
      const now = new Date().toISOString();
      const updated = await repo.update(created.id, { status: 'delivered', deliveredAt: now });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('delivered');
      expect(updated!.deliveredAt).toBe(now);
    });
  });

  describe('delete', () => {
    it('should delete a delivery', async () => {
      const created = await repo.create(createTestDelivery());
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });
  });
});