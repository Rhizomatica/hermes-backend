import { sqliteTable, text, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    callsign: text('callsign').notNull().unique(),
    displayName: text('display_name').notNull(),
    email: text('email').unique(),
    passwordHash: text('password_hash'),
    role: text('role').notNull().default('user'),
    status: text('status').notNull().default('active'),
    avatarPath: text('avatar_path'),
    metadata: text('metadata').notNull().default('{}'),
    locale: text('locale').notNull().default('en'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastSeenAt: text('last_seen_at'),
  },
  (table) => [
    index('idx_users_callsign').on(table.callsign),
    index('idx_users_role').on(table.role),
    index('idx_users_status').on(table.status),
    check(
      'chk_role',
      sql`role IN ('admin', 'operator', 'user', 'readonly')`,
    ),
    check(
      'chk_status',
      sql`status IN ('active', 'suspended', 'pending')`,
    ),
    check(
      'chk_locale',
      sql`locale IN ('en', 'es', 'pt-BR')`,
    ),
  ],
);