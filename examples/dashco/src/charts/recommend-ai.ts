/**
 * AI-augmented chart recommender.
 *
 * Runs the deterministic recommender first, then optionally asks AI for a
 * better human-readable `reason`. The deterministic chart pick and encoding
 * are immutable from AI's perspective — `reconcile` enforces this. If AI
 * proposes a different chart, the AI result is discarded (silent fallback).
 *
 * This is the only allowed use of AI in chart selection per the AI usage
 * policy. AI never picks the chart; it only writes prose.
 */

import { z } from "zod";
import { callGateway, type GatewayResult } from "../ai/gateway.js";
import { recommend } from "./recommend.js";
import type { ChartRecommendation, DataShape } from "./shape.js";

const AiResponse = z.object({
  chart: z.string(),
  reason: z.string().min(1).max(500),
});

export async function recommendWithAI(
  shape: DataShape,
): Promise<GatewayResult<ChartRecommendation>> {
  const fallback = recommend(shape);

  return callGateway<ChartRecommendation>({
    task: "chart.recommend",
    fallback,
    schema: AiResponse,
    system: SYSTEM_PROMPT,
    user: JSON.stringify({ shape, deterministicPick: fallback.chart }),
    reconcile(aiResult, det) {
      const ai = aiResult as z.infer<typeof AiResponse>;
      // Deterministic always wins on chart type. AI is only allowed to
      // overwrite the prose `reason`. If AI disagrees, throw — gateway will
      // log and return the fallback unchanged.
      if (ai.chart !== det.chart) {
        throw new Error(
          `ai disagrees: ai=${ai.chart} deterministic=${det.chart}`,
        );
      }
      return { ...det, reason: ai.reason };
    },
  });
}

const SYSTEM_PROMPT = `You are a data-visualization helper. You receive a JSON \
object describing a data shape and the chart type a deterministic algorithm \
already picked. Your job is to write a 1-2 sentence English explanation of \
why this chart fits this data. You MUST keep the same chart type the \
deterministic algorithm picked. Respond with strict JSON: \
{"chart": "<same as input>", "reason": "<your prose>"}`;
