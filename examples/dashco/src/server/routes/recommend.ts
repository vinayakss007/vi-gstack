/**
 * POST /api/charts/recommend
 *
 * Body: a DataShape object. Returns a chart recommendation served via the
 * AI gateway, which falls back to deterministic when AI is disabled. The
 * deterministic pick is always present in the response, so callers can see
 * what AI would have overridden if it were enabled.
 */

import { Hono } from "hono";
import { z } from "zod";
import { recommend } from "../../charts/recommend.js";
import { recommendWithAI } from "../../charts/recommend-ai.js";
import type { DataShape as DataShapeT } from "../../charts/shape.js";

const ColumnShape = z.object({
  name: z.string().min(1),
  kind: z.enum([
    "temporal",
    "numeric",
    "categorical",
    "high-cardinality",
    "boolean",
  ]),
  distinctCount: z.number().int().nonnegative().optional(),
  rowCount: z.number().int().nonnegative().optional(),
});

const DataShape = z.object({
  columns: z.array(ColumnShape).min(1).max(50),
});

export function recommendRoute() {
  const r = new Hono();
  r.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const parsed = DataShape.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid_payload", issues: parsed.error.issues },
        400,
      );
    }
    // Zod validated above; the cast bridges Zod's `T | undefined` optional
    // shape to TS's `exactOptionalPropertyTypes` form. Safe at this boundary.
    const shape = parsed.data as DataShapeT;
    const deterministic = recommend(shape);
    const served = await recommendWithAI(shape);
    return c.json({
      served: served.value,
      source: served.source,
      reason: served.reason,
      deterministic,
    });
  });
  return r;
}
