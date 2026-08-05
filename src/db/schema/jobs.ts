import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
    priority: integer('priority').notNull().default(5),
    status: text('status').notNull().default('queued'),
    maxAttempts: integer('max_attempts').notNull().default(3),
    attempts: integer('attempts').notNull().default(0),
    scheduledAt: text('scheduled_at'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    failedAt: text('failed_at'),
    error: text('error'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_jobs_status_priority').on(table.status, table.priority, table.createdAt),
    index('idx_jobs_scheduled').on(table.scheduledAt),
    check(
      'chk_job_status',
      sql`status IN ('queued', 'running', 'completed', 'failed', 'cancelled')`,
    ),
    check(
      'chk_job_priority',
      sql`priority BETWEEN 1 AND 10`,
    ),
  ],
);