/**
 * Deterministic triage.
 *
 * Takes a list of open tickets and returns a prioritized queue with SLA
 * deadlines and a routing decision (auto-reply vs needs-human). No AI.
 *
 * Pure function — the caller decides what to do with the routed queue.
 */

import type { Ticket, TicketCategory } from "./intake.js";

export type Route = "auto-reply" | "needs-human";

export interface TriagedTicket {
  ticket: Ticket;
  /** Lower number = higher priority. */
  priority: number;
  slaDeadline: string;
  route: Route;
  reason: string;
}

interface Policy {
  priority: number;
  slaHours: number;
  route: Route;
  reason: string;
}

const POLICY: Record<TicketCategory, Policy> = {
  abuse: {
    priority: 0,
    slaHours: 1,
    route: "needs-human",
    reason: "abuse always escalates",
  },
  auth: {
    priority: 1,
    slaHours: 4,
    route: "needs-human",
    reason: "auth issues block users from working",
  },
  billing: {
    priority: 2,
    slaHours: 8,
    route: "needs-human",
    reason: "money matters need a human signature",
  },
  bug: {
    priority: 3,
    slaHours: 24,
    route: "needs-human",
    reason: "bugs need investigation",
  },
  "feature-request": {
    priority: 4,
    slaHours: 72,
    route: "auto-reply",
    reason: "auto-acknowledge, file in backlog",
  },
  general: {
    priority: 5,
    slaHours: 48,
    route: "auto-reply",
    reason: "send standard response, escalate if user replies",
  },
};

export function triage(
  tickets: Ticket[],
  now: () => Date = () => new Date(),
): TriagedTicket[] {
  const ts = now();
  return tickets
    .map((t): TriagedTicket => {
      const p = POLICY[t.category];
      const deadline = new Date(ts.getTime() + p.slaHours * 3600_000);
      return {
        ticket: t,
        priority: p.priority,
        slaDeadline: deadline.toISOString(),
        route: p.route,
        reason: p.reason,
      };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Tiebreak: oldest first.
      return a.ticket.receivedAt.localeCompare(b.ticket.receivedAt);
    });
}
