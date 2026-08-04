import { eq } from 'drizzle-orm';
import { radioSessions } from '../../db/schema/radio-sessions.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export interface RadioSessionRow {
  id: string; stationId: string; profileId: string | null;
  startedAt: string; endedAt: string | null;
  bytesTx: number; bytesRx: number; metadata: string;
}

function rowToSession(row: typeof radioSessions.$inferSelect): RadioSessionRow {
  return { id: row.id, stationId: row.stationId, profileId: row.profileId,
    startedAt: row.startedAt, endedAt: row.endedAt,
    bytesTx: row.bytesTx, bytesRx: row.bytesRx, metadata: row.metadata };
}

export class RadioSessionsRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}
  async findById(id: string): Promise<RadioSessionRow | null> {
    const row = await this.adapter.db.select().from(radioSessions).where(eq(radioSessions.id, id)).get();
    return row ? rowToSession(row) : null;
  }
  async create(session: Omit<RadioSessionRow, 'id'>): Promise<RadioSessionRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(radioSessions).values({ id, ...session });
    return { id, ...session };
  }
  async update(id: string, updates: Partial<Omit<RadioSessionRow, 'id'>>): Promise<RadioSessionRow | null> {
    if (!(await this.findById(id))) return null;
    await this.adapter.db.update(radioSessions).set(updates).where(eq(radioSessions.id, id));
    return this.findById(id);
  }
  async delete(id: string): Promise<boolean> {
    return (await this.adapter.db.delete(radioSessions).where(eq(radioSessions.id, id))).changes > 0;
  }
}