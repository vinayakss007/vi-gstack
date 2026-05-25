/**
 * GET /api/digest?windowHours=24
 *
 * Loads tickets from the DB, runs deterministic triage and digest in
 * memory, returns the structured summary. Pure deterministic — never calls
 * AI. The numbers are the truth.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { listTickets } from "../../db/repository.js";
import { triage } from "../../ops/triage.js";
import { digest } from "../../ops/digest.js";

const Query = z.object({
  windowHours: z.coerce.number().int().positive().max(24 * 31).default(24),
});

export function digestRoute(deps: AppDeps) {
  const r = new Hono();
  r.get("/", async (c) => {
    const parsed = Query.safeParse({
      windowHours: c.req.query("windowHours"),
    });
    if (!parsed.success) {
      return c.json(
        { error: "invalid_query", issues: parsed.error.issues },
        400,
      );
    }
    const tickets = await listTickets(deps.db);
    const triaged = triage(tickets, deps.now);
    const summary = digest(
      { tickets, triaged, windowHours: parsed.data.windowHours },
      deps.now,
    );
    return c.json(summary);
  });
  return r;
}
