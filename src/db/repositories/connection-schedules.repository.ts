import { eq } from 'drizzle-orm';
import { connectionSchedules } from '../../db/schema/connection-schedules.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type ScheduleStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface ConnectionScheduleRow {
  id: string; targetCallsign: string; frequencyId: string | null;
  scheduledAt: string; recurrence: string | null; status: ScheduleStatus;
  lastRunAt: string | null; nextRunAt: string | null; createdBy: string | null;
  createdAt: string; updatedAt: string;
}
function rowToSchedule(row: typeof connectionSchedules.$inferSelect): ConnectionScheduleRow {
  return { id: row.id, targetCallsign: row.targetCallsign, frequencyId: row.frequencyId,
    scheduledAt: row.scheduledAt, recurrence: row.recurrence, status: row.status as ScheduleStatus,
    lastRunAt: row.lastRunAt, nextRunAt: row.nextRunAt, createdBy: row.createdBy,
    createdAt: row.createdAt, updatedAt: row.updatedAt };
}
export class ConnectionSchedulesRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}
  async findById(id: string): Promise<ConnectionScheduleRow | null> {
    const row = await this.adapter.db.select().from(connectionSchedules).where(eq(connectionSchedules.id, id)).get();
    return row ? rowToSchedule(row) : null;
  }
  async create(schedule: Omit<ConnectionScheduleRow, 'id'>): Promise<ConnectionScheduleRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(connectionSchedules).values({ id, ...schedule });
    return { id, ...schedule };
  }
  async listAll(): Promise<ConnectionScheduleRow[]> {
    const rows = await this.adapter.db.select().from(connectionSchedules).all();
    return rows.map(rowToSchedule);
  }
  async update(id: string, updates: Partial<Omit<ConnectionScheduleRow, 'id'>>): Promise<ConnectionScheduleRow | null> {
    if (!(await this.findById(id))) return null;
    await this.adapter.db.update(connectionSchedules).set(updates).where(eq(connectionSchedules.id, id));
    return this.findById(id);
  }
  async delete(id: string): Promise<boolean> {
    return (await this.adapter.db.delete(connectionSchedules).where(eq(connectionSchedules.id, id))).changes > 0;
  }
}