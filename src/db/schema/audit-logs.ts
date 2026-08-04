import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: text('metadata').notNull().default('{}'),
    locale: text('locale').notNull().default('en'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_audit_actor').on(table.actorId, table.createdAt),
    index('idx_audit_entity').on(table.entityType, table.entityId, table.createdAt),
    index('idx_audit_action').on(table.action, table.createdAt),
  ],
);