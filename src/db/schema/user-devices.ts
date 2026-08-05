import { sqliteTable, text, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const userDevices = sqliteTable(
  'user_devices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    deviceName: text('device_name').notNull(),
    deviceType: text('device_type').notNull(),
    pushToken: text('push_token'),
    platform: text('platform'),
    lastSeenAt: text('last_seen_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_user_devices_user_id').on(table.userId),
    check(
      'chk_device_type',
      sql`device_type IN ('mobile', 'desktop', 'station', 'browser')`,
    ),
  ],
);