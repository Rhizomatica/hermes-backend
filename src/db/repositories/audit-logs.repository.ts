import { eq, and, desc } from 'drizzle-orm';
import { auditLogs } from '../../db/schema/audit-logs.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export interface AuditLogRow {
  id: string; actorId: string | null; action: string; entityType: string;
  entityId: string; oldValue: string | null; newValue: string | null;
  ipAddress: string | null; userAgent: string | null; metadata: string;
  locale: string; createdAt: string;
}

function rowToAudit(row: typeof auditLogs.$inferSelect): AuditLogRow {
  return { id: row.id, actorId: row.actorId, action: row.action, entityType: row.entityType,
    entityId: row.entityId, oldValue: row.oldValue, newValue: row.newValue,
    ipAddress: row.ipAddress, userAgent: row.userAgent, metadata: row.metadata,
    locale: row.locale, createdAt: row.createdAt };
}

export class AuditLogsRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}
  async create(log: Omit<AuditLogRow, 'id'>): Promise<AuditLogRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(auditLogs).values({ id, ...log });
    return { id, ...log };
  }
  async listByEntity(entityType: string, entityId: string, limit = 50): Promise<AuditLogRow[]> {
    const rows = await this.adapter.db.select().from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt)).limit(limit).all();
    return rows.map(rowToAudit);
  }
  async listByActor(actorId: string, limit = 50): Promise<AuditLogRow[]> {
    const rows = await this.adapter.db.select().from(auditLogs)
      .where(eq(auditLogs.actorId, actorId))
      .orderBy(desc(auditLogs.createdAt)).limit(limit).all();
    return rows.map(rowToAudit);
  }
}