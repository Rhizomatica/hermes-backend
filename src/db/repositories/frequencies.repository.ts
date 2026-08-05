import { eq } from 'drizzle-orm';
import { frequencies } from '../../db/schema/frequencies.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type FrequencyMode = 'USB' | 'LSB' | 'CW' | 'AM' | 'FM' | 'DIGITAL';
export interface FrequencyRow { id: string; alias: string; frequencyHz: number; mode: FrequencyMode; description: string | null; isGateway: number; region: string | null; createdAt: string; updatedAt: string; }
function rowToFreq(row: typeof frequencies.$inferSelect): FrequencyRow {
  return { id: row.id, alias: row.alias, frequencyHz: row.frequencyHz, mode: row.mode as FrequencyMode, description: row.description, isGateway: row.isGateway, region: row.region, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
export class FrequenciesRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}
  async findById(id: string): Promise<FrequencyRow | null> { const row = await this.adapter.db.select().from(frequencies).where(eq(frequencies.id, id)).get(); return row ? rowToFreq(row) : null; }
  async findByAlias(alias: string): Promise<FrequencyRow | null> { const row = await this.adapter.db.select().from(frequencies).where(eq(frequencies.alias, alias)).get(); return row ? rowToFreq(row) : null; }
  async create(freq: Omit<FrequencyRow, 'id'>): Promise<FrequencyRow> { const id = crypto.randomUUID(); await this.adapter.db.insert(frequencies).values({ id, ...freq }); return { id, ...freq }; }
  async listAll(): Promise<FrequencyRow[]> { const rows = await this.adapter.db.select().from(frequencies).all(); return rows.map(rowToFreq); }
  async update(id: string, updates: Partial<Omit<FrequencyRow, 'id'>>): Promise<FrequencyRow | null> { if (!(await this.findById(id))) return null; await this.adapter.db.update(frequencies).set(updates).where(eq(frequencies.id, id)); return this.findById(id); }
  async delete(id: string): Promise<boolean> { return (await this.adapter.db.delete(frequencies).where(eq(frequencies.id, id))).changes > 0; }
}