/**
 * POST /api/fields/map
 *
 * Body: { sourceColumns: string[], targetSchema: TargetField[] }
 *
 * Returns the deterministic mapping plus the AI-augmented mapping (which is
 * identical when AI is disabled). Callers see both so they know which slots
 * the deterministic matcher filled and which (if any) AI filled.
 */

import { Hono } from "hono";
import { z } from "zod";
import { mapFields } from "../../fields/map.js";
import { mapFieldsWithAI } from "../../fields/map-ai.js";
import type { FieldMapInput } from "../../fields/types.js";

const TargetField = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const Body = z.object({
  sourceColumns: z.array(z.string().min(1)).min(1).max(200),
  targetSchema: z.array(TargetField).min(1).max(200),
});

export function fieldsRoute() {
  const r = new Hono();
  r.post("/map", async (c) => {
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
    const input = parsed.data as FieldMapInput;
    const deterministic = mapFields(input);
    const served = await mapFieldsWithAI(input);
    return c.json({
      served: served.value,
      source: served.source,
      reason: served.reason,
      deterministic,
    });
  });
  return r;
}
