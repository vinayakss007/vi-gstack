/**
 * AI-augmented narrator.
 *
 * Runs the deterministic narrator first to get structured insights with
 * load-bearing `facts` and deterministic `text`. Then, if AI is enabled,
 * asks AI to rewrite ONLY the `text` of each insight in clearer English.
 *
 * Privacy: AI never sees the raw data values. It only sees the deterministic
 * summary numbers (mean, max, etc.) plus the deterministic text it is
 * rewriting. This matches the policy requirement that AI is not on a hot
 * path and does not handle raw customer data.
 *
 * Reconciliation rules:
 *   - AI must return exactly one rewritten string per deterministic insight.
 *     If the count differs, throw → silent fallback to deterministic.
 *   - Each AI string is bounded by length and stripped of leading bullet
 *     glyphs.
 *   - `kind` and `facts` are never overwritten. AI cannot change the
 *     numbers; the deterministic text remains accessible if the caller
 *     wants it.
 *
 * This is the policy in code: AI augments prose, never replaces facts.
 */

import { z } from "zod";
import { callGateway, type GatewayResult } from "../ai/gateway.js";
import { narrate } from "./narrate.js";
import type { Insight, InsightInput, InsightOutput } from "./types.js";

const AiResponse = z.object({
  bullets: z.array(z.string().min(1).max(280)),
});

export async function narrateWithAI(
  input: InsightInput,
): Promise<GatewayResult<InsightOutput>> {
  const fallback = narrate(input);

  // No insights -> nothing for AI to rewrite.
  if (fallback.insights.length === 0) {
    return { value: fallback, source: "fallback", reason: "ai-disabled" };
  }

  return callGateway<InsightOutput>({
    task: "insights.narrate",
    fallback,
    schema: AiResponse,
    system: SYSTEM_PROMPT,
    user: JSON.stringify({
      metric: fallback.metric,
      bullets: fallback.insights.map((i) => ({
        kind: i.kind,
        deterministicText: i.text,
        facts: i.facts,
      })),
    }),
    reconcile(aiResult, det) {
      const ai = aiResult as z.infer<typeof AiResponse>;
      if (ai.bullets.length !== det.insights.length) {
        throw new Error(
          `ai returned ${ai.bullets.length} bullets, expected ${det.insights.length}`,
        );
      }
      const rewritten: Insight[] = det.insights.map((insight, i) => ({
        kind: insight.kind,
        facts: insight.facts,
        text: cleanBullet(ai.bullets[i]!),
      }));
      return { metric: det.metric, insights: rewritten };
    },
  });
}

function cleanBullet(s: string): string {
  // Strip leading bullet glyphs / numbers / dashes that AI sometimes adds.
  return s.replace(/^[\s\-*\u2022\u00b7\d.)]+/, "").trim();
}

const SYSTEM_PROMPT = `You are a data-insights narrator. You receive a metric \
name and a list of insights produced by a deterministic statistical \
algorithm. Each insight has a kind, a deterministic English text, and a \
"facts" object with the underlying numbers. Your job is to rewrite each \
insight's text to be clearer and more natural. You MUST keep the same number \
of insights. You MUST preserve the meaning. You MUST NOT invent numbers, \
labels, or trends not in the facts. Respond with strict JSON: \
{"bullets": ["...", "...", ...]} with one rewritten string per insight, \
in the same order.`;
