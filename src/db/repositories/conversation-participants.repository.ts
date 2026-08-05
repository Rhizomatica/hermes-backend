import { eq, and, isNull } from 'drizzle-orm';
import { conversationParticipants } from '../../db/schema/conversation-participants.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type ParticipantRole = 'owner' | 'admin' | 'member';

export interface ConversationParticipantRow {
  id: string;
  conversationId: string;
  userId: string;
  role: ParticipantRole;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  mutedUntil: string | null;
  joinedAt: string;
  leftAt: string | null;
}

function rowToParticipant(
  row: typeof conversationParticipants.$inferSelect,
): ConversationParticipantRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    userId: row.userId,
    role: row.role as ParticipantRole,
    lastReadMessageId: row.lastReadMessageId,
    lastReadAt: row.lastReadAt,
    mutedUntil: row.mutedUntil,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
  };
}

export class ConversationParticipantsRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async findById(id: string): Promise<ConversationParticipantRow | null> {
    const row = await this.adapter.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.id, id))
      .get();
    return row ? rowToParticipant(row) : null;
  }

  async findByConversationAndUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipantRow | null> {
    const row = await this.adapter.db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      )
      .get();
    return row ? rowToParticipant(row) : null;
  }

  async create(
    participant: Omit<ConversationParticipantRow, 'id'>,
  ): Promise<ConversationParticipantRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(conversationParticipants).values({
      id,
      conversationId: participant.conversationId,
      userId: participant.userId,
      role: participant.role,
      lastReadMessageId: participant.lastReadMessageId,
      lastReadAt: participant.lastReadAt,
      mutedUntil: participant.mutedUntil,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
    });
    return { id, ...participant };
  }

  async listByConversationId(conversationId: string): Promise<ConversationParticipantRow[]> {
    const rows = await this.adapter.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId))
      .all();
    return rows.map(rowToParticipant);
  }

  async listActiveByUserId(userId: string): Promise<ConversationParticipantRow[]> {
    const rows = await this.adapter.db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, userId),
          isNull(conversationParticipants.leftAt),
        ),
      )
      .all();
    return rows.map(rowToParticipant);
  }

  async update(
    id: string,
    updates: Partial<Omit<ConversationParticipantRow, 'id'>>,
  ): Promise<ConversationParticipantRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    await this.adapter.db
      .update(conversationParticipants)
      .set(updates)
      .where(eq(conversationParticipants.id, id));
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.adapter.db
      .update(conversationParticipants)
      .set({ leftAt: now })
      .where(eq(conversationParticipants.id, id));
    return result.changes > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(conversationParticipants)
      .where(eq(conversationParticipants.id, id));
    return result.changes > 0;
  }
}