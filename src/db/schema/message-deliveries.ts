import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const messageDeliveries = sqliteTable(
  'message_deliveries',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id').notNull(),
    recipientId: text('recipient_id').notNull(),
    channel: text('channel').notNull(),
    status: text('status').notNull().default('pending'),
    sentAt: text('sent_at'),
    deliveredAt: text('delivered_at'),
    readAt: text('read_at'),
    failedAt: text('failed_at'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    nextRetryAt: text('next_retry_at'),
  },
  (table) => [
    index('idx_deliveries_message').on(table.messageId),
    index('idx_deliveries_recipient_status').on(table.recipientId, table.status),
    index('idx_deliveries_next_retry').on(table.nextRetryAt),
    check(
      'chk_channel',
      sql`channel IN ('websocket', 'email', 'radio', 'push', 'sms')`,
    ),
    check(
      'chk_status',
      sql`status IN ('pending', 'sent', 'delivered', 'read', 'failed')`,
    ),
  ],
);