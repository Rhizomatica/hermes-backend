import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const radioProfiles = sqliteTable(
  'radio_profiles',
  {
    id: text('id').primaryKey(),
    stationId: text('station_id').notNull(),
    profileIndex: integer('profile_index').notNull(),
    name: text('name').notNull(),
    frequencyHz: integer('frequency_hz').notNull(),
    mode: text('mode').notNull(),
    volume: integer('volume').notNull().default(50),
    bfoHz: integer('bfo_hz').notNull().default(0),
    digitalVoice: integer('digital_voice').notNull().default(0),
    powerLevel: integer('power_level'),
    isActive: integer('is_active').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  () => [
    check(
      'chk_mode',
      sql`mode IN ('USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL')`,
    ),
    check('chk_volume', sql`volume BETWEEN 0 AND 100`),
  ],
);