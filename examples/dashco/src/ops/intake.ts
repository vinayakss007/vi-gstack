/**
 * Deterministic intake.
 *
 * Receives a webhook payload (form, email, Stripe event), classifies it into
 * a ticket category, validates required fields, and returns a normalized
 * ticket. No AI.
 *
 * Pure function — the caller decides where the ticket gets persisted.
 */

import { z } from "zod";

export const IntakePayload = z.object({
  source: z.enum(["form", "email", "stripe", "github"]),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(20_000),
  email: z.string().email().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type IntakePayload = z.infer<typeof IntakePayload>;

export type TicketCategory =
  | "billing"
  | "bug"
  | "feature-request"
  | "auth"
  | "abuse"
  | "general";

export interface Ticket {
  id: string;
  source: IntakePayload["source"];
  category: TicketCategory;
  subject: string;
  body: string;
  email: string | undefined;
  receivedAt: string;
  /** Which keyword fired the category, for auditability. */
  classifierRule: string;
}

const RULES: { category: TicketCategory; rule: string; pattern: RegExp }[] = [
  // Order matters — more specific first.
  {
    category: "abuse",
    rule: "abuse-keywords",
    pattern: /\b(spam|abuse|harass(ment)?|phish(ing)?)\b/i,
  },
  {
    category: "billing",
    rule: "billing-keywords",
    pattern: /\b(invoice|charge|refund|subscription|cancel|payment|stripe|card)\b/i,
  },
  {
    category: "auth",
    rule: "auth-keywords",
    pattern: /\b(login|sign[- ]?in|password|reset|2fa|mfa|sso|locked out)\b/i,
  },
  {
    category: "bug",
    rule: "bug-keywords",
    pattern: /\b(bug|broken|error|crash|stack trace|exception|500|404)\b/i,
  },
  {
    category: "feature-request",
    rule: "feature-keywords",
    pattern: /\b(feature|request|wish|could you|please add|would be great)\b/i,
  },
];

export function intake(
  payload: IntakePayload,
  now: () => Date = () => new Date(),
  randomId: () => string = defaultRandomId,
): Ticket {
  const parsed = IntakePayload.parse(payload);
  const haystack = `${parsed.subject}\n${parsed.body}`;

  // Stripe payloads are unambiguously billing.
  if (parsed.source === "stripe") {
    return finalize(parsed, "billing", "source-stripe", now, randomId);
  }

  for (const r of RULES) {
    if (r.pattern.test(haystack)) {
      return finalize(parsed, r.category, r.rule, now, randomId);
    }
  }

  return finalize(parsed, "general", "fallback-general", now, randomId);
}

function finalize(
  payload: IntakePayload,
  category: TicketCategory,
  classifierRule: string,
  now: () => Date,
  randomId: () => string,
): Ticket {
  return {
    id: randomId(),
    source: payload.source,
    category,
    subject: payload.subject,
    body: payload.body,
    email: payload.email,
    receivedAt: now().toISOString(),
    classifierRule,
  };
}

function defaultRandomId(): string {
  // Node 18+/Bun both expose crypto.randomUUID
  return crypto.randomUUID();
}
