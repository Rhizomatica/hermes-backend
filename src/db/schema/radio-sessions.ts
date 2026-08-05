import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const radioSessions = sqliteTable(
  'radio_sessions',
  {
    id: text('id').primaryKey(),
    stationId: text('station_id').notNull(),
    profileId: text('profile_id'),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    bytesTx: integer('bytes_tx').notNull().default(0),
    bytesRx: integer('bytes_rx').notNull().default(0),
    metadata: text('metadata').notNull().default('{}'),
  },
  (table) => [
    index('idx_radio_sessions_station').on(table.stationId, table.startedAt),
  ],
);