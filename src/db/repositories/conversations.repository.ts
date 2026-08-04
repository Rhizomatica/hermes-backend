import { eq, desc } from 'drizzle-orm';
import { conversations } from '../../db/schema/conversations.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type ConversationType = 'direct' | 'group' | 'broadcast' | 'radio';

export interface ConversationRow {
  id: string;
  type: ConversationType;
  title: string | null;
  description: string | null;
  avatarPath: string | null;
  createdBy: string;
  lastActivityAt: string | null;
  archivedAt: string | null;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

function rowToConversation(row: typeof conversations.$inferSelect): ConversationRow {
  return {
    id: row.id,
    type: row.type as ConversationType,
    title: row.title,
    description: row.description,
    avatarPath: row.avatarPath,
    createdBy: row.createdBy,
    lastActivityAt: row.lastActivityAt,
    archivedAt: row.archivedAt,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ConversationsRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async findById(id: string): Promise<ConversationRow | null> {
    const row = await this.adapter.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .get();
    return row ? rowToConversation(row) : null;
  }

  async create(conversation: Omit<ConversationRow, 'id'>): Promise<ConversationRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(conversations).values({
      id,
      type: conversation.type,
      title: conversation.title,
      description: conversation.description,
      avatarPath: conversation.avatarPath,
      createdBy: conversation.createdBy,
      lastActivityAt: conversation.lastActivityAt,
      archivedAt: conversation.archivedAt,
      metadata: conversation.metadata,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
    return { id, ...conversation };
  }

  async listByUserId(
    userId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<ConversationRow[]> {
    const rows = await this.adapter.db
      .select()
      .from(conversations)
      .where(eq(conversations.createdBy, userId))
      .orderBy(desc(conversations.lastActivityAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0)
      .all();
    return rows.map(rowToConversation);
  }

  async listAll(): Promise<ConversationRow[]> {
    const rows = await this.adapter.db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.lastActivityAt))
      .all();
    return rows.map(rowToConversation);
  }

  async update(
    id: string,
    updates: Partial<Omit<ConversationRow, 'id'>>,
  ): Promise<ConversationRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    await this.adapter.db.update(conversations).set(updates).where(eq(conversations.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(conversations)
      .where(eq(conversations.id, id));
    return result.changes > 0;
  }
}