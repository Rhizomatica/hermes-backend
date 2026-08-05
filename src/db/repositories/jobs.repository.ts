import { eq, desc } from 'drizzle-orm';
import { jobs } from '../../db/schema/jobs.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface JobRow {
  id: string; type: string; payload: string; priority: number; status: JobStatus;
  maxAttempts: number; attempts: number; scheduledAt: string | null;
  startedAt: string | null; completedAt: string | null; failedAt: string | null;
  error: string | null; createdAt: string;
}
function rowToJob(row: typeof jobs.$inferSelect): JobRow {
  return { id: row.id, type: row.type, payload: row.payload, priority: row.priority,
    status: row.status as JobStatus, maxAttempts: row.maxAttempts, attempts: row.attempts,
    scheduledAt: row.scheduledAt, startedAt: row.startedAt, completedAt: row.completedAt,
    failedAt: row.failedAt, error: row.error, createdAt: row.createdAt };
}

export class JobsRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}
  async findById(id: string): Promise<JobRow | null> {
    const row = await this.adapter.db.select().from(jobs).where(eq(jobs.id, id)).get();
    return row ? rowToJob(row) : null;
  }
  async create(job: Omit<JobRow, 'id'>): Promise<JobRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(jobs).values({ id, ...job });
    return { id, ...job };
  }
  async listQueued(limit = 100): Promise<JobRow[]> {
    const rows = await this.adapter.db.select().from(jobs)
      .where(eq(jobs.status, 'queued'))
      .orderBy(desc(jobs.priority), jobs.createdAt).limit(limit).all();
    return rows.map(rowToJob);
  }
  async update(id: string, updates: Partial<Omit<JobRow, 'id'>>): Promise<JobRow | null> {
    if (!(await this.findById(id))) return null;
    await this.adapter.db.update(jobs).set(updates).where(eq(jobs.id, id));
    return this.findById(id);
  }
  async delete(id: string): Promise<boolean> {
    return (await this.adapter.db.delete(jobs).where(eq(jobs.id, id))).changes > 0;
  }
}