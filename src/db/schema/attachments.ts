import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id'),
    conversationId: text('conversation_id'),
    uploaderId: text('uploader_id').notNull(),
    filename: text('filename').notNull(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storagePath: text('storage_path').notNull(),
    storageBackend: text('storage_backend').notNull().default('local'),
    checksum: text('checksum').notNull(),
    previewPath: text('preview_path'),
    status: text('status').notNull().default('pending'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at'),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('idx_attachments_message').on(table.messageId),
    index('idx_attachments_checksum').on(table.checksum),
    index('idx_attachments_uploader').on(table.uploaderId),
    index('idx_attachments_status').on(table.status),
    check(
      'chk_storage_backend',
      sql`storage_backend IN ('local', 's3', 'gcs')`,
    ),
    check(
      'chk_status',
      sql`status IN ('pending', 'processing', 'ready', 'failed', 'expired')`,
    ),
  ],
);