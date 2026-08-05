import { eq } from 'drizzle-orm';
import { userDevices } from '../../db/schema/user-devices.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type DeviceType = 'mobile' | 'desktop' | 'station' | 'browser';
export interface UserDeviceRow { id: string; userId: string; deviceName: string; deviceType: DeviceType; pushToken: string | null; platform: string | null; lastSeenAt: string | null; createdAt: string; updatedAt: string; }
function rowToDevice(row: typeof userDevices.$inferSelect): UserDeviceRow {
  return { id: row.id, userId: row.userId, deviceName: row.deviceName, deviceType: row.deviceType as DeviceType, pushToken: row.pushToken, platform: row.platform, lastSeenAt: row.lastSeenAt, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
export class UserDevicesRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}
  async findById(id: string): Promise<UserDeviceRow | null> { const row = await this.adapter.db.select().from(userDevices).where(eq(userDevices.id, id)).get(); return row ? rowToDevice(row) : null; }
  async create(device: Omit<UserDeviceRow, 'id'>): Promise<UserDeviceRow> { const id = crypto.randomUUID(); await this.adapter.db.insert(userDevices).values({ id, ...device }); return { id, ...device }; }
  async listByUserId(userId: string): Promise<UserDeviceRow[]> { const rows = await this.adapter.db.select().from(userDevices).where(eq(userDevices.userId, userId)).all(); return rows.map(rowToDevice); }
  async update(id: string, updates: Partial<Omit<UserDeviceRow, 'id'>>): Promise<UserDeviceRow | null> { if (!(await this.findById(id))) return null; await this.adapter.db.update(userDevices).set(updates).where(eq(userDevices.id, id)); return this.findById(id); }
  async delete(id: string): Promise<boolean> { return (await this.adapter.db.delete(userDevices).where(eq(userDevices.id, id))).changes > 0; }
}