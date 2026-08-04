import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const userSessions = sqliteTable(
  'user_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    deviceId: text('device_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    refreshReplacedBy: text('refresh_replaced_by'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_user_sessions_user_id').on(table.userId),
    index('idx_user_sessions_token_hash').on(table.tokenHash),
    index('idx_user_sessions_expires_active').on(table.expiresAt),
  ],
);
