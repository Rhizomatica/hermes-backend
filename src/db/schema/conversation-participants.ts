import { sqliteTable, text, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const conversationParticipants = sqliteTable(
  'conversation_participants',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull().default('member'),
    lastReadMessageId: text('last_read_message_id'),
    lastReadAt: text('last_read_at'),
    mutedUntil: text('muted_until'),
    joinedAt: text('joined_at').notNull(),
    leftAt: text('left_at'),
  },
  (table) => [
    index('idx_conv_participants_conversation').on(table.conversationId),
    index('idx_conv_participants_user').on(table.userId),
    check(
      'chk_role',
      sql`role IN ('owner', 'admin', 'member')`,
    ),
  ],
);