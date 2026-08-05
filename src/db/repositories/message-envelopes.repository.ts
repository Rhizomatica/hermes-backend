import { eq } from 'drizzle-orm';
import { messageEnvelopes } from '../../db/schema/message-envelopes.js';
import type { DatabaseAdapter } from '../../db/adapter.js';

export type EnvelopeType = 'inbound' | 'outbound';
export type EnvelopeTransport = 'smtp' | 'uucp' | 'radio' | 'hmp' | 'internal';
export type EnvelopeStatus = 'pending' | 'processing' | 'sent' | 'received' | 'failed';
export type EnvelopeLocale = 'en' | 'es' | 'pt-BR';

export interface MessageEnvelopeRow {
  id: string;
  messageId: string;
  envelopeType: EnvelopeType;
  fromAddress: string;
  toAddresses: string;
  ccAddresses: string;
  bccAddresses: string;
  subject: string | null;
  headers: string;
  rawMessagePath: string | null;
  transport: EnvelopeTransport;
  externalMessageId: string | null;
  status: EnvelopeStatus;
  locale: EnvelopeLocale;
  createdAt: string;
  processedAt: string | null;
}

function rowToEnvelope(row: typeof messageEnvelopes.$inferSelect): MessageEnvelopeRow {
  return {
    id: row.id,
    messageId: row.messageId,
    envelopeType: row.envelopeType as EnvelopeType,
    fromAddress: row.fromAddress,
    toAddresses: row.toAddresses,
    ccAddresses: row.ccAddresses,
    bccAddresses: row.bccAddresses,
    subject: row.subject,
    headers: row.headers,
    rawMessagePath: row.rawMessagePath,
    transport: row.transport as EnvelopeTransport,
    externalMessageId: row.externalMessageId,
    status: row.status as EnvelopeStatus,
    locale: row.locale as EnvelopeLocale,
    createdAt: row.createdAt,
    processedAt: row.processedAt,
  };
}

export class MessageEnvelopesRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async findById(id: string): Promise<MessageEnvelopeRow | null> {
    const row = await this.adapter.db
      .select()
      .from(messageEnvelopes)
      .where(eq(messageEnvelopes.id, id))
      .get();
    return row ? rowToEnvelope(row) : null;
  }

  async findByMessageId(messageId: string): Promise<MessageEnvelopeRow | null> {
    const row = await this.adapter.db
      .select()
      .from(messageEnvelopes)
      .where(eq(messageEnvelopes.messageId, messageId))
      .get();
    return row ? rowToEnvelope(row) : null;
  }

  async create(envelope: Omit<MessageEnvelopeRow, 'id'>): Promise<MessageEnvelopeRow> {
    const id = crypto.randomUUID();
    await this.adapter.db.insert(messageEnvelopes).values({
      id,
      messageId: envelope.messageId,
      envelopeType: envelope.envelopeType,
      fromAddress: envelope.fromAddress,
      toAddresses: envelope.toAddresses,
      ccAddresses: envelope.ccAddresses,
      bccAddresses: envelope.bccAddresses,
      subject: envelope.subject,
      headers: envelope.headers,
      rawMessagePath: envelope.rawMessagePath,
      transport: envelope.transport,
      externalMessageId: envelope.externalMessageId,
      status: envelope.status,
      locale: envelope.locale,
      createdAt: envelope.createdAt,
      processedAt: envelope.processedAt,
    });
    return { id, ...envelope };
  }

  async update(
    id: string,
    updates: Partial<Omit<MessageEnvelopeRow, 'id'>>,
  ): Promise<MessageEnvelopeRow | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    await this.adapter.db
      .update(messageEnvelopes)
      .set(updates)
      .where(eq(messageEnvelopes.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.adapter.db
      .delete(messageEnvelopes)
      .where(eq(messageEnvelopes.id, id));
    return result.changes > 0;
  }
}