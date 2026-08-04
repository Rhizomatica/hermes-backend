import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { MessageEnvelopesRepository } from '../../../src/db/repositories/message-envelopes.repository.js';
import type { MessageEnvelopeRow } from '../../../src/db/repositories/message-envelopes.repository.js';

let adapter: SQLiteAdapter;
let repo: MessageEnvelopesRepository;

function createTestEnvelope(overrides?: Partial<Omit<MessageEnvelopeRow, 'id'>>): Omit<MessageEnvelopeRow, 'id'> {
  const now = new Date().toISOString();
  return {
    messageId: 'msg-id-1',
    envelopeType: 'outbound',
    fromAddress: 'sender@hermes.local',
    toAddresses: '["recipient@example.com"]',
    ccAddresses: '[]',
    bccAddresses: '[]',
    subject: 'Test Message',
    headers: '{}',
    rawMessagePath: null,
    transport: 'smtp',
    externalMessageId: null,
    status: 'pending',
    locale: 'en',
    createdAt: now,
    processedAt: null,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');

  adapter.db.run(`
    CREATE TABLE message_envelopes (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      envelope_type TEXT NOT NULL CHECK(envelope_type IN ('inbound', 'outbound')),
      from_address TEXT NOT NULL,
      to_addresses TEXT DEFAULT '[]' NOT NULL,
      cc_addresses TEXT DEFAULT '[]' NOT NULL,
      bcc_addresses TEXT DEFAULT '[]' NOT NULL,
      subject TEXT,
      headers TEXT DEFAULT '{}' NOT NULL,
      raw_message_path TEXT,
      transport TEXT NOT NULL CHECK(transport IN ('smtp', 'uucp', 'radio', 'hmp', 'internal')),
      external_message_id TEXT,
      status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'processing', 'sent', 'received', 'failed')),
      locale TEXT DEFAULT 'en' NOT NULL CHECK(locale IN ('en', 'es', 'pt-BR')),
      created_at TEXT NOT NULL,
      processed_at TEXT
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_envelopes_message ON message_envelopes (message_id)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_envelopes_status ON message_envelopes (status, transport)');

  repo = new MessageEnvelopesRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('MessageEnvelopesRepository', () => {
  describe('create', () => {
    it('should create an envelope', async () => {
      const result = await repo.create(createTestEnvelope({ messageId: 'msg-create-1' }));
      expect(result.id).toBeDefined();
      expect(result.envelopeType).toBe('outbound');
      expect(result.transport).toBe('smtp');
      expect(result.locale).toBe('en');
    });

    it('should create an envelope with pt-BR locale', async () => {
      const result = await repo.create(createTestEnvelope({ messageId: 'msg-create-2', locale: 'pt-BR' }));
      expect(result.locale).toBe('pt-BR');
    });
  });

  describe('findByMessageId', () => {
    it('should find an envelope by messageId', async () => {
      await repo.create(createTestEnvelope({ messageId: 'msg-unique' }));
      const found = await repo.findByMessageId('msg-unique');
      expect(found).not.toBeNull();
      expect(found!.messageId).toBe('msg-unique');
    });

    it('should return null for non-existent messageId', async () => {
      expect(await repo.findByMessageId('non-existent')).toBeNull();
    });
  });

  describe('update', () => {
    it('should update envelope status', async () => {
      const created = await repo.create(createTestEnvelope({ messageId: 'msg-update' }));
      const now = new Date().toISOString();
      const updated = await repo.update(created.id, { status: 'sent', processedAt: now });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('sent');
      expect(updated!.processedAt).toBe(now);
    });
  });

  describe('delete', () => {
    it('should delete an envelope', async () => {
      const created = await repo.create(createTestEnvelope({ messageId: 'msg-delete' }));
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });
  });
});