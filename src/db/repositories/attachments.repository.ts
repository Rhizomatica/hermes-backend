import { eq } from 'drizzle-orm';
import { attachments } from '../../db/schema/attachments.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type StorageBackend = 'local' | 's3' | 'gcs';
export type AttachmentStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'expired';

export interface AttachmentRow {
  id: string;
  messageId: string | null;
  conversationId: string | null;
  uploaderId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  storageBackend: StorageBackend;
  checksum: string;
  previewPath: string | null;
  status: AttachmentStatus;
  metadata: string;
  createdAt: string;
  expiresAt: string | null;
  deletedAt: string | null;
}

function rowToAttachment(row: typeof attachments.$inferSelect): AttachmentRow {
  return {
    id: row.id,
    messageId: row.messageId,
    conversationId: row.conversationId,
    uploaderId: row.uploaderId,
    filename: row.filename,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    storageBackend: row.storageBackend as StorageBackend,
    checksum: row.checksum,
    previewPath: row.previewPath,
    status: row.status as AttachmentStatus,
    metadata: row.metadata,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    deletedAt: row.deletedAt,
  };
}

export class AttachmentsRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async findById(id: string): Promise<AttachmentRow | null> {
    const row = await this.adapter.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .get();
    return row ? rowToAttachment(row) : null;
  }

  async findByChecksum(checksum: string): Promise<AttachmentRow | null> {
    const row = await this.adapter.db
      .select()
      .from(attachments)
      .where(eq(attachments.checksum, checksum))
      .get();
    return row ? rowToAttachment(row) : null;
  }

  async create(attachment: Omit<AttachmentRow, 'id'>): Promise<AttachmentRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(attachments).values({
      id,
      messageId: attachment.messageId,
      conversationId: attachment.conversationId,
      uploaderId: attachment.uploaderId,
      filename: attachment.filename,
      originalFilename: attachment.originalFilename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      storagePath: attachment.storagePath,
      storageBackend: attachment.storageBackend,
      checksum: attachment.checksum,
      previewPath: attachment.previewPath,
      status: attachment.status,
      metadata: attachment.metadata,
      createdAt: attachment.createdAt,
      expiresAt: attachment.expiresAt,
      deletedAt: attachment.deletedAt,
    });
    return { id, ...attachment };
  }

  async update(
    id: string,
    updates: Partial<Omit<AttachmentRow, 'id'>>,
  ): Promise<AttachmentRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    await this.adapter.db
      .update(attachments)
      .set(updates)
      .where(eq(attachments.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(attachments)
      .where(eq(attachments.id, id));
    return result.changes > 0;
  }
}