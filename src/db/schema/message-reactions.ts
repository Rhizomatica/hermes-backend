import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * Message Reactions
 * =================
 *
 * Stores emoji reactions on messages. Each row represents one reaction from a
 * user to a message.
 *
 * ## UNIQUE Constraint & Toggle Behavior
 *
 * The `UNIQUE (message_id, user_id, emoji)` constraint (defined in the SQL migration)
 * prevents a user from reacting with the same emoji to the same message more than
 * once. This is intentional:
 *
 * - **To "toggle" a reaction off**: The client should call `MessageReactionsRepository.delete()`
 *   to remove the reaction, then optionally call `create()` to re-add it. There is no
 *   server-side toggle — the client is responsible for the two-step remove+add flow.
 * - **Rationale**: A UNIQUE constraint is more reliable than an upsert approach
 *   (which would require a composite primary key or conflict resolution). It also
 *   prevents accidental duplicate reactions from buggy clients or retry storms.
 *
 * If toggle support becomes a common UX pattern, a future migration could replace
 * the UNIQUE with a composite PK on (message_id, user_id, emoji) plus an
 * `ON CONFLICT DO NOTHING` on insert. For now, the explicit delete+create pattern
 * is the documented contract.
 */
export const messageReactions = sqliteTable(
  'message_reactions',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id').notNull(),
    userId: text('user_id').notNull(),
    emoji: text('emoji').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_reactions_message').on(table.messageId),
  ],
);
