import { eq, and } from 'drizzle-orm';
import { messageReactions } from '../../db/schema/message-reactions.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export interface MessageReactionRow {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

function rowToReaction(row: typeof messageReactions.$inferSelect): MessageReactionRow {
  return {
    id: row.id,
    messageId: row.messageId,
    userId: row.userId,
    emoji: row.emoji,
    createdAt: row.createdAt,
  };
}

export class MessageReactionsRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async create(reaction: Omit<MessageReactionRow, 'id'>): Promise<MessageReactionRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(messageReactions).values({
      id,
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      createdAt: reaction.createdAt,
    });
    return { id, ...reaction };
  }

  async listByMessageId(messageId: string): Promise<MessageReactionRow[]> {
    const rows = await this.adapter.db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId))
      .all();
    return rows.map(rowToReaction);
  }

  async delete(messageId: string, userId: string, emoji: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.emoji, emoji),
        ),
      );
    return result.changes > 0;
  }

  async deleteAll(): Promise<void> {
    await this.adapter.db.delete(messageReactions);
  }
}