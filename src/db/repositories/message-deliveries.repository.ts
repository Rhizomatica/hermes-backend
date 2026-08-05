import { eq, and } from 'drizzle-orm';
import { messageDeliveries } from '../../db/schema/message-deliveries.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type DeliveryChannel = 'websocket' | 'email' | 'radio' | 'push' | 'sms';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageDeliveryRow {
  id: string;
  messageId: string;
  recipientId: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  error: string | null;
  attempts: number;
  nextRetryAt: string | null;
}

function rowToDelivery(row: typeof messageDeliveries.$inferSelect): MessageDeliveryRow {
  return {
    id: row.id,
    messageId: row.messageId,
    recipientId: row.recipientId,
    channel: row.channel as DeliveryChannel,
    status: row.status as DeliveryStatus,
    sentAt: row.sentAt,
    deliveredAt: row.deliveredAt,
    readAt: row.readAt,
    failedAt: row.failedAt,
    error: row.error,
    attempts: row.attempts,
    nextRetryAt: row.nextRetryAt,
  };
}

export class MessageDeliveriesRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async findById(id: string): Promise<MessageDeliveryRow | null> {
    const row = await this.adapter.db
      .select()
      .from(messageDeliveries)
      .where(eq(messageDeliveries.id, id))
      .get();
    return row ? rowToDelivery(row) : null;
  }

  async create(delivery: Omit<MessageDeliveryRow, 'id'>): Promise<MessageDeliveryRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(messageDeliveries).values({
      id,
      messageId: delivery.messageId,
      recipientId: delivery.recipientId,
      channel: delivery.channel,
      status: delivery.status,
      sentAt: delivery.sentAt,
      deliveredAt: delivery.deliveredAt,
      readAt: delivery.readAt,
      failedAt: delivery.failedAt,
      error: delivery.error,
      attempts: delivery.attempts,
      nextRetryAt: delivery.nextRetryAt,
    });
    return { id, ...delivery };
  }

  async listByMessageId(messageId: string): Promise<MessageDeliveryRow[]> {
    const rows = await this.adapter.db
      .select()
      .from(messageDeliveries)
      .where(eq(messageDeliveries.messageId, messageId))
      .all();
    return rows.map(rowToDelivery);
  }

  async listPendingByRecipient(recipientId: string): Promise<MessageDeliveryRow[]> {
    const rows = await this.adapter.db
      .select()
      .from(messageDeliveries)
      .where(
        and(
          eq(messageDeliveries.recipientId, recipientId),
          eq(messageDeliveries.status, 'pending'),
        ),
      )
      .all();
    return rows.map(rowToDelivery);
  }

  async update(
    id: string,
    updates: Partial<Omit<MessageDeliveryRow, 'id'>>,
  ): Promise<MessageDeliveryRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    await this.adapter.db
      .update(messageDeliveries)
      .set(updates)
      .where(eq(messageDeliveries.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(messageDeliveries)
      .where(eq(messageDeliveries.id, id));
    return result.changes > 0;
  }
}