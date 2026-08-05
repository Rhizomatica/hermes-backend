import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteAdapter } from '../../../src/db/sqlite.adapter.js';
import { AttachmentsRepository } from '../../../src/db/repositories/attachments.repository.js';
import type { AttachmentRow } from '../../../src/db/repositories/attachments.repository.js';

let adapter: SQLiteAdapter;
let repo: AttachmentsRepository;

function createTestAttachment(overrides?: Partial<Omit<AttachmentRow, 'id'>>): Omit<AttachmentRow, 'id'> {
  const now = new Date().toISOString();
  return {
    messageId: null,
    conversationId: null,
    uploaderId: 'user-id-1',
    filename: 'test-file.pdf',
    originalFilename: 'original.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    storagePath: '/storage/test-file.pdf',
    storageBackend: 'local',
    checksum: 'abc123def456',
    previewPath: null,
    status: 'pending',
    metadata: '{}',
    createdAt: now,
    expiresAt: null,
    deletedAt: null,
    ...overrides,
  };
}

beforeAll(() => {
  adapter = new SQLiteAdapter(':memory:');
  adapter.db.run('PRAGMA foreign_keys = OFF');

  adapter.db.run(`
    CREATE TABLE attachments (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT,
      conversation_id TEXT,
      uploader_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      storage_backend TEXT DEFAULT 'local' NOT NULL
        CHECK(storage_backend IN ('local', 's3', 'gcs')),
      checksum TEXT NOT NULL,
      preview_path TEXT,
      status TEXT DEFAULT 'pending' NOT NULL
        CHECK(status IN ('pending', 'processing', 'ready', 'failed', 'expired')),
      metadata TEXT DEFAULT '{}' NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      deleted_at TEXT
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments (message_id)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_attachments_checksum ON attachments (checksum)');

  repo = new AttachmentsRepository(adapter);
});

afterAll(async () => {
  await adapter.close();
});

describe('AttachmentsRepository', () => {
  describe('create', () => {
    it('should create an attachment', async () => {
      const result = await repo.create(createTestAttachment());
      expect(result.id).toBeDefined();
      expect(result.filename).toBe('test-file.pdf');
      expect(result.checksum).toBe('abc123def456');
    });
  });

  describe('findByChecksum', () => {
    it('should find an attachment by checksum (dedup)', async () => {
      await repo.create(createTestAttachment({ checksum: 'dedup-hash' }));
      const found = await repo.findByChecksum('dedup-hash');
      expect(found).not.toBeNull();
      expect(found!.checksum).toBe('dedup-hash');
    });

    it('should return null for unknown checksum', async () => {
      expect(await repo.findByChecksum('unknown')).toBeNull();
    });
  });

  describe('update', () => {
    it('should update attachment status', async () => {
      const created = await repo.create(createTestAttachment());
      const updated = await repo.update(created.id, { status: 'ready' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('ready');
    });
  });

  describe('delete', () => {
    it('should delete an attachment', async () => {
      const created = await repo.create(createTestAttachment());
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
    });
  });
});