/**
 * AI-augmented field mapper.
 *
 * Runs `mapFields` first. For source columns the deterministic matcher could
 * not place, asks AI for suggestions. AI may only fill slots the
 * deterministic path left empty - it can never override a deterministic
 * decision. Each AI suggestion is validated against the same scoring function
 * the deterministic path uses, with a sanity floor: if the source/target pair
 * has zero similarity, AI's suggestion is rejected (likely hallucination).
 *
 * This is the policy in code: AI augments, never replaces. Deterministic
 * always wins on disagreement.
 */

import { z } from "zod";
import { callGateway, type GatewayResult } from "../ai/gateway.js";
import { mapFields, score } from "./map.js";
import type {
  FieldMapInput,
  FieldMapResult,
  FieldMapping,
} from "./types.js";

const AiResponse = z.object({
  mappings: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
        confidence: z.number().min(0).max(1).default(0.5),
      }),
    )
    .max(50),
});

const AI_SANITY_FLOOR = 0.1;

export async function mapFieldsWithAI(
  input: FieldMapInput,
): Promise<GatewayResult<FieldMapResult>> {
  const fallback = mapFields(input);

  // Nothing left to do - deterministic path covered everything.
  if (fallback.unmappedSource.length === 0) {
    return { value: fallback, source: "fallback", reason: "ai-disabled" };
  }

  const targetByName = new Map(
    input.targetSchema.map((t) => [t.name, t] as const),
  );

  return callGateway<FieldMapResult>({
    task: "fields.map",
    fallback,
    schema: AiResponse,
    system: SYSTEM_PROMPT,
    user: JSON.stringify({
      unmatchedSourceColumns: fallback.unmappedSource,
      unmatchedTargetFields: fallback.unmappedTarget.map((name) => {
        const t = targetByName.get(name);
        return {
          name,
          aliases: t?.aliases ?? [],
          description: t?.description ?? "",
        };
      }),
    }),
    reconcile(aiResult, det) {
      const ai = aiResult as z.infer<typeof AiResponse>;
      const usedSources = new Set(det.mappings.map((m) => m.source));
      const usedTargets = new Set(det.mappings.map((m) => m.target));
      const allowedSources = new Set(det.unmappedSource);
      const allowedTargets = new Set(det.unmappedTarget);
      const accepted: FieldMapping[] = [...det.mappings];

      for (const proposed of ai.mappings) {
        if (usedSources.has(proposed.source)) continue;
        if (usedTargets.has(proposed.target)) continue;
        if (!allowedSources.has(proposed.source)) continue;
        if (!allowedTargets.has(proposed.target)) continue;
        const tgt = targetByName.get(proposed.target);
        if (!tgt) continue;
        const det_score = score(proposed.source, tgt);
        if (det_score.score < AI_SANITY_FLOOR) continue;

        accepted.push({
          source: proposed.source,
          target: proposed.target,
          score: proposed.confidence,
          method: "ai",
        });
        usedSources.add(proposed.source);
        usedTargets.add(proposed.target);
      }

      // If AI added nothing useful, surface that as a rejection so the
      // gateway logs it and returns the deterministic fallback unchanged.
      if (accepted.length === det.mappings.length) {
        throw new Error("ai proposals all rejected by sanity checks");
      }

      const unmappedSource = input.sourceColumns.filter(
        (s) => !usedSources.has(s),
      );
      const unmappedTarget = input.targetSchema
        .map((t) => t.name)
        .filter((t) => !usedTargets.has(t));

      accepted.sort(
        (a, b) =>
          input.sourceColumns.indexOf(a.source) -
          input.sourceColumns.indexOf(b.source),
      );

      return { mappings: accepted, unmappedSource, unmappedTarget };
    },
  });
}

const SYSTEM_PROMPT = `You map customer CSV column names to a known target \
schema. You receive only the columns the deterministic matcher could not \
place. Suggest pairwise mappings between the unmatched source columns and \
the unmatched target fields. Do not invent fields. Do not propose mappings \
the deterministic matcher already made. Respond with strict JSON: \
{"mappings": [{"source": "...", "target": "...", "confidence": 0.0..1.0}]}. \
If no good mapping exists, return {"mappings": []}.`;
