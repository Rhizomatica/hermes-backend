import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { messages } from '../../db/schema/messages.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

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

  async create(
    message: Omit<MessageRow, 'id' | 'contentChecksum'>,
  ): Promise<MessageRow> {
    const id = crypto.randomUUID();
    const contentChecksum = computeChecksum(message.content);
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
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
      metadata: message.metadata,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    });
    const row = await this.findById(id);
    if (!row) throw new Error('Failed to create message');
    return row;
  }

  async listByConversationId(
    conversationId: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<MessageRow[]> {
    const conditions = [
      eq(messages.conversationId, conversationId),
      isNull(messages.deletedAt),
    ];

    if (opts.cursor) {
      // cursor-based pagination: messages older than the cursor timestamp
      conditions.push(sql`${messages.createdAt} < ${opts.cursor}`);
    }

    const rows = await this.adapter.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(opts.limit ?? 50)
      .all();
    return rows.map(rowToMessage);
  }

  async update(
    id: string,
    updates: Partial<Omit<MessageRow, 'id' | 'contentChecksum'>> & {
      contentChecksum?: string | null;
    },
  ): Promise<MessageRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const values: Record<string, unknown> = { ...updates };

    // If content changed, recompute checksum
    if (updates.content !== undefined && updates.contentChecksum === undefined) {
      values.contentChecksum = computeChecksum(updates.content);
    }

    await this.adapter.db
      .update(messages)
      .set(values as typeof messages.$inferInsert)
      .where(eq(messages.id, id));
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.adapter.db
      .update(messages)
      .set({ deletedAt: now, content: null })
      .where(and(eq(messages.id, id), isNull(messages.deletedAt)));
    return result.changes > 0;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(messages)
      .where(eq(messages.id, id));
    return result.changes > 0;
  }
}

