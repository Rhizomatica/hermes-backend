import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const frequencies = sqliteTable(
  'frequencies',
  {
    id: text('id').primaryKey(),
    alias: text('alias').notNull().unique(),
    frequencyHz: integer('frequency_hz').notNull(),
    mode: text('mode').notNull().default('USB'),
    description: text('description'),
    isGateway: integer('is_gateway').notNull().default(0),
    region: text('region'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_frequencies_alias').on(table.alias),
    index('idx_frequencies_gateway').on(table.isGateway),
    check(
      'chk_freq_mode',
      sql`mode IN ('USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL')`,
    ),
  ],
);