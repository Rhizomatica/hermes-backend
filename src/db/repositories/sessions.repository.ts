import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { userSessions } from '../../db/schema/user-sessions.js';
import type { SQLiteAdapter } from '../../db/sqlite.adapter.js';

export interface SessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class SessionsRepository {
  constructor(private readonly adapter: SQLiteAdapter) {}

  async create(session: { userId: string; refreshToken: string; deviceId?: string; ipAddress?: string; userAgent?: string; expiresAt: string }): Promise<SessionRow> {
    const id = crypto.randomUUID();
    const tokenHash = hashToken(session.refreshToken);
    const createdAt = new Date().toISOString();

    await this.adapter.db.insert(userSessions).values({
      id, userId: session.userId, tokenHash,
      deviceId: session.deviceId || null,
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
      expiresAt: session.expiresAt, revokedAt: null, createdAt,
    });

    return {
      id, userId: session.userId, tokenHash,
      deviceId: session.deviceId || null,
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
      expiresAt: session.expiresAt, revokedAt: null, createdAt,
    };
  }

  async findByTokenHash(token: string): Promise<SessionRow | null> {
    const tokenHash = hashToken(token);
    const row = await this.adapter.db.select().from(userSessions)
      .where(and(eq(userSessions.tokenHash, tokenHash), isNull(userSessions.revokedAt)))
      .get();
    if (!row) return null;
    return {
      id: row.id, userId: row.userId, tokenHash: row.tokenHash,
      deviceId: row.deviceId, ipAddress: row.ipAddress, userAgent: row.userAgent,
      expiresAt: row.expiresAt, revokedAt: row.revokedAt, createdAt: row.createdAt,
    };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.adapter.db.update(userSessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
  }

  async revoke(id: string): Promise<boolean> {
    const result = await this.adapter.db.update(userSessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(userSessions.id, id));
    return result.changes > 0;
  }
}
