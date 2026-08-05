import { sqliteTable, text, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const messageEnvelopes = sqliteTable(
  'message_envelopes',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id').notNull().unique(),
    envelopeType: text('envelope_type').notNull(),
    fromAddress: text('from_address').notNull(),
    toAddresses: text('to_addresses').notNull().default('[]'),
    ccAddresses: text('cc_addresses').notNull().default('[]'),
    bccAddresses: text('bcc_addresses').notNull().default('[]'),
    subject: text('subject'),
    headers: text('headers').notNull().default('{}'),
    rawMessagePath: text('raw_message_path'),
    transport: text('transport').notNull(),
    externalMessageId: text('external_message_id'),
    status: text('status').notNull().default('pending'),
    locale: text('locale').notNull().default('en'),
    createdAt: text('created_at').notNull(),
    processedAt: text('processed_at'),
  },
  (table) => [
    index('idx_envelopes_message').on(table.messageId),
    index('idx_envelopes_status').on(table.status, table.transport),
    index('idx_envelopes_external_id').on(table.externalMessageId),
    check(
      'chk_envelope_type',
      sql`envelope_type IN ('inbound', 'outbound')`,
    ),
    check(
      'chk_transport',
      sql`transport IN ('smtp', 'uucp', 'radio', 'hmp', 'internal')`,
    ),
    check(
      'chk_envelope_status',
      sql`status IN ('pending', 'processing', 'sent', 'received', 'failed')`,
    ),
    check(
      'chk_envelope_locale',
      sql`locale IN ('en', 'es', 'pt-BR')`,
    ),
  ],
);