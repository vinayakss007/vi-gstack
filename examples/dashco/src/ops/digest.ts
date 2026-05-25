/**
 * Deterministic daily digest.
 *
 * Aggregates tickets received in the last N hours into a structured summary.
 * The output is plain data; a separate adapter formats it for email/Slack. No
 * AI. The numbers are the truth; AI is not allowed to write the digest.
 *
 * (If you later want AI prose around these numbers, route through the gateway
 * with the digest as `fallback`. The numbers stay deterministic.)
 */

import type { Ticket, TicketCategory } from "./intake.js";
import type { TriagedTicket } from "./triage.js";

export interface DigestInput {
  tickets: Ticket[];
  triaged: TriagedTicket[];
  windowHours: number;
}

export interface Digest {
  windowHours: number;
  generatedAt: string;
  totals: {
    received: number;
    autoReplied: number;
    needsHuman: number;
    overdue: number;
  };
  byCategory: Record<TicketCategory, number>;
  topPriority: {
    id: string;
    subject: string;
    category: TicketCategory;
    slaDeadline: string;
  }[];
}

const ALL_CATEGORIES: TicketCategory[] = [
  "abuse",
  "auth",
  "billing",
  "bug",
  "feature-request",
  "general",
];

const TOP_PRIORITY_LIMIT = 5;

export function digest(
  input: DigestInput,
  now: () => Date = () => new Date(),
): Digest {
  const ts = now();
  const cutoff = new Date(ts.getTime() - input.windowHours * 3600_000);

  const inWindow = input.tickets.filter(
    (t) => new Date(t.receivedAt) >= cutoff,
  );
  const triagedInWindow = input.triaged.filter((t) =>
    inWindow.some((x) => x.id === t.ticket.id),
  );

  const byCategory: Record<TicketCategory, number> = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, 0]),
  ) as Record<TicketCategory, number>;
  for (const t of inWindow) byCategory[t.category]++;

  const overdue = triagedInWindow.filter(
    (t) => new Date(t.slaDeadline) < ts,
  ).length;

  const autoReplied = triagedInWindow.filter(
    (t) => t.route === "auto-reply",
  ).length;
  const needsHuman = triagedInWindow.filter(
    (t) => t.route === "needs-human",
  ).length;

  const topPriority = [...triagedInWindow]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, TOP_PRIORITY_LIMIT)
    .map((t) => ({
      id: t.ticket.id,
      subject: t.ticket.subject,
      category: t.ticket.category,
      slaDeadline: t.slaDeadline,
    }));

  return {
    windowHours: input.windowHours,
    generatedAt: ts.toISOString(),
    totals: {
      received: inWindow.length,
      autoReplied,
      needsHuman,
      overdue,
    },
    byCategory,
    topPriority,
  };
}
