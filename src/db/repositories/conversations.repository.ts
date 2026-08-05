import { eq, desc, and, isNull } from 'drizzle-orm';
import { conversations } from '../../db/schema/conversations.js';
import { conversationParticipants } from '../../db/schema/conversation-participants.js';
import type { DatabaseAdapter } from '../../db/adapter.js';
import { validateJsonField } from '../../shared/json-validator.js';

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

/** Input type for create — excludes auto-managed fields */
export type CreateConversationInput = Omit<ConversationRow, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
};

/** Input type for update — excludes auto-managed fields */
export type UpdateConversationInput = Partial<Omit<ConversationRow, 'id' | 'createdAt' | 'updatedAt'>> & {
  createdAt?: string;
  updatedAt?: string;
};

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

  async create(conversation: CreateConversationInput): Promise<ConversationRow> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Validate JSON metadata field
    validateJsonField('conversations.metadata', conversation.metadata);

    await this.adapter.db.insert(conversations).values({
      id,
      type: conversation.type,
      title: conversation.title,
      description: conversation.description,
      avatarPath: conversation.avatarPath,
      createdBy: conversation.createdBy,
      lastActivityAt: conversation.lastActivityAt ?? null,
      archivedAt: conversation.archivedAt ?? null,
      metadata: conversation.metadata ?? '{}',
      createdAt: conversation.createdAt ?? now,
      updatedAt: conversation.updatedAt ?? now,
    });
    return (await this.findById(id))!;
  }

  /**
   * List conversations created by a specific user.
   *
   * **Note**: This only returns conversations where `createdBy === userId`.
   * It does NOT return conversations where the user is a participant but not
   * the creator — use `listByParticipant()` for that.
   *
   * @deprecated Use `listByCreatedBy()` instead. `listByUserId` is kept as an
   * alias for backward compatibility but the name was misleading (it only
   * queries `created_by`, not all conversations the user belongs to).
   */
  async listByUserId(
    userId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<ConversationRow[]> {
    return this.listByCreatedBy(userId, opts);
  }

  /**
   * List conversations created by a specific user (queried via `created_by` column).
   *
   * @param userId The creator's user ID
   * @param opts Pagination options
   */
  async listByCreatedBy(
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

  /**
   * List conversations where a user is an active participant (via JOIN with
   * `conversation_participants`). Returns conversations the user belongs to,
   * regardless of who created them.
   *
   * @param userId The participant's user ID
   * @param opts Pagination options
   */
  async listByParticipant(
    userId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<ConversationRow[]> {
    const rows = await this.adapter.db
      .select({
        id: conversations.id,
        type: conversations.type,
        title: conversations.title,
        description: conversations.description,
        avatarPath: conversations.avatarPath,
        createdBy: conversations.createdBy,
        lastActivityAt: conversations.lastActivityAt,
        archivedAt: conversations.archivedAt,
        metadata: conversations.metadata,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .innerJoin(
        conversationParticipants,
        and(
          eq(conversations.id, conversationParticipants.conversationId),
          eq(conversationParticipants.userId, userId),
          isNull(conversationParticipants.leftAt),
        ),
      )
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

  async update(id: string, updates: UpdateConversationInput): Promise<ConversationRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const values: Record<string, unknown> = { ...updates, updatedAt: updates.updatedAt ?? now };

    // Validate JSON metadata if provided
    if (updates.metadata !== undefined) {
      validateJsonField('conversations.metadata', updates.metadata);
    }

    await this.adapter.db.update(conversations).set(values).where(eq(conversations.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(conversations)
      .where(eq(conversations.id, id));
    return result.changes > 0;
  }
}