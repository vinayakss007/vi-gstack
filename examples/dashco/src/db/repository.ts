/**
 * Thin repository layer mapping between the deterministic Ticket type
 * (string receivedAt, string|undefined email) and the DB row (Date, string|null).
 *
 * The intake function returns a Ticket; the digest function consumes Tickets;
 * the DB stores rows. This file is the only place that knows about the
 * shape mismatch.
 */

import { desc } from "drizzle-orm";
import type { Db } from "./client.js";
import { tickets } from "./schema.js";
import type { Ticket, TicketCategory } from "../ops/intake.js";

const VALID_SOURCES = new Set(["form", "email", "stripe", "github"] as const);
const VALID_CATEGORIES = new Set([
  "abuse",
  "auth",
  "billing",
  "bug",
  "feature-request",
  "general",
] as const);

export async function insertTicket(db: Db, t: Ticket): Promise<void> {
  await db.insert(tickets).values({
    id: t.id,
    source: t.source,
    category: t.category,
    subject: t.subject,
    body: t.body,
    email: t.email ?? null,
    receivedAt: new Date(t.receivedAt),
    classifierRule: t.classifierRule,
  });
}

export async function listTickets(db: Db): Promise<Ticket[]> {
  const rows = await db.select().from(tickets).orderBy(desc(tickets.receivedAt));
  return rows.map(rowToTicket);
}

function rowToTicket(r: typeof tickets.$inferSelect): Ticket {
  if (!VALID_SOURCES.has(r.source as (typeof VALID_SOURCES extends Set<infer T> ? T : never))) {
    throw new Error(`invalid source in db: ${r.source}`);
  }
  if (
    !VALID_CATEGORIES.has(
      r.category as (typeof VALID_CATEGORIES extends Set<infer T> ? T : never),
    )
  ) {
    throw new Error(`invalid category in db: ${r.category}`);
  }
  return {
    id: r.id,
    source: r.source as Ticket["source"],
    category: r.category as TicketCategory,
    subject: r.subject,
    body: r.body,
    email: r.email ?? undefined,
    receivedAt: r.receivedAt.toISOString(),
    classifierRule: r.classifierRule,
  };
}
