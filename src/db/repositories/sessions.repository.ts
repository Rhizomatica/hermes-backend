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
  refreshReplacedBy: string | null;
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
      expiresAt: session.expiresAt, revokedAt: null, refreshReplacedBy: null, createdAt,
    });

    return {
      id, userId: session.userId, tokenHash,
      deviceId: session.deviceId || null,
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
      expiresAt: session.expiresAt, revokedAt: null, refreshReplacedBy: null, createdAt,
    };
  }

  async findByTokenHash(token: string): Promise<SessionRow | null> {
    const tokenHash = hashToken(token);
    const row = await this.adapter.db.select().from(userSessions)
      .where(eq(userSessions.tokenHash, tokenHash))
      .get();
    if (!row) return null;
    return this.rowToSession(row);
  }

  async findByActiveTokenHash(token: string): Promise<SessionRow | null> {
    const tokenHash = hashToken(token);
    const row = await this.adapter.db.select().from(userSessions)
      .where(and(eq(userSessions.tokenHash, tokenHash), isNull(userSessions.revokedAt)))
      .get();
    if (!row) return null;
    return this.rowToSession(row);
  }

  async markReplacedBy(id: string, replacementHash: string): Promise<void> {
    await this.adapter.db.update(userSessions)
      .set({ refreshReplacedBy: replacementHash })
      .where(eq(userSessions.id, id));
  }

  async createAndReplace(
    oldSessionId: string,
    newSession: { userId: string; refreshToken: string; deviceId?: string; ipAddress?: string; userAgent?: string; expiresAt: string },
  ): Promise<{ oldSession: SessionRow; newSession: SessionRow }> {
    const newId = crypto.randomUUID();
    const newTokenHash = hashToken(newSession.refreshToken);
    const createdAt = new Date().toISOString();

    const oldSession = await this.adapter.db.select().from(userSessions)
      .where(eq(userSessions.id, oldSessionId))
      .get();
    if (!oldSession) throw new Error('Session not found');

    this.adapter.db.transaction((tx) => {
      tx.update(userSessions)
        .set({ refreshReplacedBy: newTokenHash })
        .where(eq(userSessions.id, oldSessionId))
        .run();
      tx.insert(userSessions).values({
        id: newId,
        userId: newSession.userId,
        tokenHash: newTokenHash,
        deviceId: newSession.deviceId || null,
        ipAddress: newSession.ipAddress || null,
        userAgent: newSession.userAgent || null,
        expiresAt: newSession.expiresAt,
        revokedAt: null,
        refreshReplacedBy: null,
        createdAt,
      }).run();
    });

    return {
      oldSession: this.rowToSession({ ...oldSession, refreshReplacedBy: newTokenHash }),
      newSession: {
        id: newId, userId: newSession.userId, tokenHash: newTokenHash,
        deviceId: newSession.deviceId || null,
        ipAddress: newSession.ipAddress || null,
        userAgent: newSession.userAgent || null,
        expiresAt: newSession.expiresAt, revokedAt: null, refreshReplacedBy: null, createdAt,
      },
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

  private rowToSession(row: typeof userSessions.$inferSelect): SessionRow {
    return {
      id: row.id, userId: row.userId, tokenHash: row.tokenHash,
      deviceId: row.deviceId, ipAddress: row.ipAddress, userAgent: row.userAgent,
      expiresAt: row.expiresAt, revokedAt: row.revokedAt,
      refreshReplacedBy: row.refreshReplacedBy || null,
      createdAt: row.createdAt,
    };
  }
}
