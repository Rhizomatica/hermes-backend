import { sqliteTable, text, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    title: text('title'),
    description: text('description'),
    avatarPath: text('avatar_path'),
    createdBy: text('created_by').notNull(),
    lastActivityAt: text('last_activity_at'),
    archivedAt: text('archived_at'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_conversations_type').on(table.type),
    index('idx_conversations_last_activity').on(table.lastActivityAt),
    index('idx_conversations_created_by').on(table.createdBy),
    check(
      'chk_type',
      sql`type IN ('direct', 'group', 'broadcast', 'radio')`,
    ),
  ],
);