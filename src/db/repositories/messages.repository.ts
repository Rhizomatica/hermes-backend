import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { messages } from '../../db/schema/messages.js';
import type { DatabaseAdapter } from '../../db/adapter.js';
import { validateJsonField } from '../../shared/json-validator.js';

export type ContentType = 'text' | 'markdown' | 'html' | 'audio' | 'system' | 'attachment_only';
export type MessageStatus = 'draft' | 'sending' | 'sent' | 'failed';

export interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string | null;
  content: string | null;
  contentChecksum: string | null;
  contentType: ContentType;
  replyToMessageId: string | null;
  forwardedFromId: string | null;
  subject: string | null;
  status: MessageStatus;
  editedAt: string | null;
  deletedAt: string | null;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

/** Input type for create — excludes auto-managed fields */
export type CreateMessageInput = Omit<MessageRow, 'id' | 'contentChecksum' | 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
};

/** Input type for update — excludes auto-managed fields */
export type UpdateMessageInput = Partial<Omit<MessageRow, 'id' | 'contentChecksum' | 'createdAt' | 'updatedAt'>> & {
  createdAt?: string;
  updatedAt?: string;
};

function computeChecksum(content: string | null): string | null {
  if (content === null) return null;
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function rowToMessage(row: typeof messages.$inferSelect): MessageRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    clientMessageId: row.clientMessageId,
    content: row.content,
    contentChecksum: row.contentChecksum,
    contentType: row.contentType as ContentType,
    replyToMessageId: row.replyToMessageId,
    forwardedFromId: row.forwardedFromId,
    subject: row.subject,
    status: row.status as MessageStatus,
    editedAt: row.editedAt,
    deletedAt: row.deletedAt,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Paginated result returned by list methods that support cursor-based pagination */
export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export class MessagesRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async findById(id: string): Promise<MessageRow | null> {
    const row = await this.adapter.db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .get();
    return row ? rowToMessage(row) : null;
  }

  async findByClientMessageId(clientMessageId: string): Promise<MessageRow | null> {
    const row = await this.adapter.db
      .select()
      .from(messages)
      .where(eq(messages.clientMessageId, clientMessageId))
      .get();
    return row ? rowToMessage(row) : null;
  }

  async create(message: CreateMessageInput): Promise<MessageRow> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const contentChecksum = computeChecksum(message.content);

    // Validate JSON metadata field
    validateJsonField('messages.metadata', message.metadata);

    await this.adapter.db.insert(messages).values({
      id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientMessageId: message.clientMessageId,
      content: message.content,
      contentChecksum,
      contentType: message.contentType,
      replyToMessageId: message.replyToMessageId,
      forwardedFromId: message.forwardedFromId,
      subject: message.subject,
      status: message.status,
      editedAt: message.editedAt ?? null,
      deletedAt: message.deletedAt ?? null,
      metadata: message.metadata ?? '{}',
      createdAt: message.createdAt ?? now,
      updatedAt: message.updatedAt ?? now,
    });
    const row = await this.findById(id);
    if (!row) throw new Error('Failed to create message');
    return row;
  }

  async listByConversationId(
    conversationId: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<PaginatedResult<MessageRow>> {
    const limit = opts.limit ?? 50;
    const conditions = [
      eq(messages.conversationId, conversationId),
      isNull(messages.deletedAt),
    ];

    if (opts.cursor) {
      // cursor-based pagination: messages older than the cursor timestamp
      conditions.push(sql`${messages.createdAt} < ${opts.cursor}`);
    }

    // Fetch one extra row to determine if there's a next page
    const rows = await this.adapter.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1)
      .all();

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(rowToMessage);
    const lastItem = hasMore && items.length > 0 ? items[items.length - 1] : undefined;
    const nextCursor = lastItem?.createdAt ?? null;

    return { items, nextCursor };
  }

  async update(id: string, updates: UpdateMessageInput): Promise<MessageRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const values: Record<string, unknown> = { ...updates, updatedAt: updates.updatedAt ?? now };

    // If content changed, recompute checksum
    if (updates.content !== undefined) {
      values.contentChecksum = computeChecksum(updates.content);
    }

    // Validate JSON metadata if provided
    if (updates.metadata !== undefined) {
      validateJsonField('messages.metadata', updates.metadata);
    }

    await this.adapter.db
      .update(messages)
      .set(values)
      .where(eq(messages.id, id));
    return this.findById(id);
  }

  /**
   * Soft-delete a message by setting deletedAt. Preserves content for compliance
   * (messages are excluded from list queries via the `WHERE deletedAt IS NULL` filter).
   * Use `purgeExpiredContent()` to clear content from already-deleted messages
   * after the retention period.
   */
  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.adapter.db
      .update(messages)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(messages.id, id), isNull(messages.deletedAt)));
    return result.changes > 0;
  }

  /**
   * Purge content from messages that were soft-deleted before the given date.
   * This nullifies the content field for compliance with data retention policies
   * while preserving the audit trail (id, timestamps, sender, conversation references).
   *
   * @param olderThan ISO-8601 timestamp — purge content from messages deleted before this date
   * @returns Number of messages whose content was purged
   */
  async purgeExpiredContent(olderThan: string): Promise<number> {
    const result = await this.adapter.db
      .update(messages)
      .set({ content: null, contentChecksum: null, updatedAt: new Date().toISOString() })
      .where(
        and(
          sql`${messages.deletedAt} IS NOT NULL`,
          sql`${messages.content} IS NOT NULL`,
          sql`${messages.deletedAt} < ${olderThan}`,
        ),
      );
    return result.changes;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(messages)
      .where(eq(messages.id, id));
    return result.changes > 0;
  }
}

