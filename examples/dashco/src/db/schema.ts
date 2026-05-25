/**
 * Drizzle schema. One table for now — tickets — keyed by the deterministic
 * intake function. Triage runs in-memory on read, so the DB does not store
 * triage state. Pure deterministic functions don't need a persistence layer
 * behind them.
 */

import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    email: text("email"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    classifierRule: text("classifier_rule").notNull(),
  },
  (t) => [
    index("tickets_received_at_idx").on(t.receivedAt),
    index("tickets_category_idx").on(t.category),
  ],
);

export type TicketRow = typeof tickets.$inferSelect;
export type TicketInsert = typeof tickets.$inferInsert;
