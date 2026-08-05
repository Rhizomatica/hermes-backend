import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * Audit Logs
 * ===========
 *
 * Immutable append-only table for tracking all state-changing operations.
 *
 * ## Locale Column
 *
 * `locale` records the end-user's language preference at the time the audit
 * event occurred. This column exists on specific tables only:
 *
 *   | Table              | Has locale? | Rationale                           |
 *   |--------------------|-------------|-------------------------------------|
 *   | audit_logs         | ✅          | Audit viewer shows localized labels |
 *   | message_envelopes  | ✅          | Email/radio envelope routing locale |
 *   | users              | ✅          | Per-user language preference        |
 *   | messages           | ❌          | Content locale is message-level     |
 *   | conversations      | ❌          | Not user-facing as a standalone     |
 *
 * This is not an inconsistency — it reflects a deliberate "only where needed"
 * approach. Adding locale to all tables would be redundant (e.g., a message's
 * locale can be inferred from its envelope or sender's profile).
 */
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
