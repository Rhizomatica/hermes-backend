import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const messageReactions = sqliteTable(
  'message_reactions',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id').notNull(),
    userId: text('user_id').notNull(),
    emoji: text('emoji').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_reactions_message').on(table.messageId),
  ],
);