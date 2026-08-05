import { sqliteTable, text, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull(),
    senderId: text('sender_id').notNull(),
    clientMessageId: text('client_message_id').unique(),
    content: text('content'),
    contentChecksum: text('content_checksum'),
    contentType: text('content_type').notNull().default('text'),
    replyToMessageId: text('reply_to_message_id'),
    forwardedFromId: text('forwarded_from_id'),
    subject: text('subject'),
    status: text('status').notNull().default('sending'),
    editedAt: text('edited_at'),
    deletedAt: text('deleted_at'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_messages_conversation_created').on(
      table.conversationId,
      table.createdAt,
    ),
    index('idx_messages_sender').on(table.senderId),
    index('idx_messages_client_id').on(table.clientMessageId),
    index('idx_messages_reply_to').on(table.replyToMessageId),
    check(
      'chk_content_type',
      sql`content_type IN ('text', 'markdown', 'html', 'audio', 'system', 'attachment_only')`,
    ),
    check(
      'chk_status',
      sql`status IN ('draft', 'sending', 'sent', 'failed')`,
    ),
  ],
);