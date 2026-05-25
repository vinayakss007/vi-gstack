/**
 * POST /api/intake
 *
 * Validates webhook payload, runs the deterministic classifier, persists the
 * resulting ticket, returns it. Pure deterministic — never calls AI.
 */

import { Hono } from "hono";
import type { AppDeps } from "../app.js";
import { intake, IntakePayload } from "../../ops/intake.js";
import { insertTicket } from "../../db/repository.js";

export function intakeRoute(deps: AppDeps) {
  const r = new Hono();
  r.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const parsed = IntakePayload.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid_payload", issues: parsed.error.issues },
        400,
      );
    }
    const ticket = intake(parsed.data, deps.now);
    await insertTicket(deps.db, ticket);
    return c.json(ticket, 201);
  });
  return r;
}
