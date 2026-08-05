import { eq } from 'drizzle-orm';
import { radioProfiles } from '../../db/schema/radio-profiles.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type RadioMode = 'USB' | 'LSB' | 'CW' | 'AM' | 'FM' | 'DIGITAL';

export interface RadioProfileRow {
  id: string;
  stationId: string;
  profileIndex: number;
  name: string;
  frequencyHz: number;
  mode: RadioMode;
  volume: number;
  bfoHz: number;
  digitalVoice: number;
  powerLevel: number | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

function rowToProfile(row: typeof radioProfiles.$inferSelect): RadioProfileRow {
  return {
    id: row.id, stationId: row.stationId, profileIndex: row.profileIndex,
    name: row.name, frequencyHz: row.frequencyHz, mode: row.mode as RadioMode,
    volume: row.volume, bfoHz: row.bfoHz, digitalVoice: row.digitalVoice,
    powerLevel: row.powerLevel, isActive: row.isActive,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export class RadioProfilesRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}
  async findById(id: string): Promise<RadioProfileRow | null> {
    const row = await this.adapter.db.select().from(radioProfiles).where(eq(radioProfiles.id, id)).get();
    return row ? rowToProfile(row) : null;
  }
  async create(profile: Omit<RadioProfileRow, 'id'>): Promise<RadioProfileRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(radioProfiles).values({ id, ...profile });
    return { id, ...profile };
  }
  async listByStationId(stationId: string): Promise<RadioProfileRow[]> {
    const rows = await this.adapter.db.select().from(radioProfiles).where(eq(radioProfiles.stationId, stationId)).all();
    return rows.map(rowToProfile);
  }
  async update(id: string, updates: Partial<Omit<RadioProfileRow, 'id'>>): Promise<RadioProfileRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    await this.adapter.db.update(radioProfiles).set(updates).where(eq(radioProfiles.id, id));
    return this.findById(id);
  }
  async delete(id: string): Promise<boolean> {
    const result = await this.adapter.db.delete(radioProfiles).where(eq(radioProfiles.id, id));
    return result.changes > 0;
  }
}