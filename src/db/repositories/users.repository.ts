import { eq } from 'drizzle-orm';
import { users } from '../../db/schema/users.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export interface UserRow {
  id: string;
  callsign: string;
  displayName: string;
  email: string | null;
  passwordHash: string | null;
  role: 'admin' | 'operator' | 'user' | 'readonly';
  status: 'active' | 'suspended' | 'pending';
  avatarPath: string | null;
  metadata: string;
  locale: 'en' | 'es' | 'pt-BR';
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
}

function rowToUser(row: typeof users.$inferSelect): UserRow {
  return {
    id: row.id, callsign: row.callsign, displayName: row.displayName,
    email: row.email, passwordHash: row.passwordHash,
    role: row.role as UserRow['role'], status: row.status as UserRow['status'],
    avatarPath: row.avatarPath, metadata: row.metadata,
    locale: row.locale as UserRow['locale'], createdAt: row.createdAt,
    updatedAt: row.updatedAt, lastSeenAt: row.lastSeenAt,
  };
}

export class UsersRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async findByCallsign(callsign: string): Promise<UserRow | null> {
    const row = await this.adapter.db.select().from(users).where(eq(users.callsign, callsign)).get();
    return row ? rowToUser(row) : null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const row = await this.adapter.db.select().from(users).where(eq(users.id, id)).get();
    return row ? rowToUser(row) : null;
  }

  async create(user: Omit<UserRow, 'id'>): Promise<UserRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(users).values({
      id, callsign: user.callsign, displayName: user.displayName,
      email: user.email, passwordHash: user.passwordHash, role: user.role,
      status: user.status, avatarPath: user.avatarPath, metadata: user.metadata,
      locale: user.locale, createdAt: user.createdAt, updatedAt: user.updatedAt,
      lastSeenAt: user.lastSeenAt,
    });
    return { id, ...user };
  }

  async listAll(): Promise<UserRow[]> {
    const rows = await this.adapter.db.select().from(users).all();
    return rows.map(rowToUser);
  }

  async update(id: string, updates: Partial<Omit<UserRow, 'id'>>): Promise<UserRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    await this.adapter.db.update(users).set(updates).where(eq(users.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.adapter.db.delete(users).where(eq(users.id, id));
    return result.changes > 0;
  }
}
