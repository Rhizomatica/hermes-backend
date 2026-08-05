import { sqliteTable, text, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const connectionSchedules = sqliteTable(
  'connection_schedules',
  {
    id: text('id').primaryKey(),
    targetCallsign: text('target_callsign').notNull(),
    frequencyId: text('frequency_id'),
    scheduledAt: text('scheduled_at').notNull(),
    recurrence: text('recurrence'),
    status: text('status').notNull().default('pending'),
    lastRunAt: text('last_run_at'),
    nextRunAt: text('next_run_at'),
    createdBy: text('created_by'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_schedules_next_run').on(table.nextRunAt),
    check(
      'chk_schedule_status',
      sql`status IN ('pending', 'running', 'completed', 'failed', 'cancelled')`,
    ),
  ],
);