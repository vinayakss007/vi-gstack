/**
 * POST /api/insights
 *
 * Body: { metric: string, values: number[], labels?: string[] }
 *
 * Returns the deterministic insights and the served (AI-augmented or
 * fallback) insights side-by-side. The numbers are identical in both —
 * AI may only rewrite the prose `text` field.
 */

import { Hono } from "hono";
import { z } from "zod";
import { narrate } from "../../insights/narrate.js";
import { narrateWithAI } from "../../insights/narrate-ai.js";
import type { InsightInput } from "../../insights/types.js";

const Body = z.object({
  metric: z.string().min(1).max(120),
  values: z.array(z.number().finite()).min(1).max(10_000),
  labels: z.array(z.string().min(1).max(120)).optional(),
});

export function insightsRoute() {
  const r = new Hono();
  r.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid_payload", issues: parsed.error.issues },
        400,
      );
    }
    if (
      parsed.data.labels &&
      parsed.data.labels.length !== parsed.data.values.length
    ) {
      return c.json(
        { error: "labels_length_mismatch" },
        400,
      );
    }
    const input = parsed.data as InsightInput;
    const deterministic = narrate(input);
    const served = await narrateWithAI(input);
    return c.json({
      served: served.value,
      source: served.source,
      reason: served.reason,
      deterministic,
    });
  });
  return r;
}
