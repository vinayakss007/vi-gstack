/**
 * Top-level deterministic field mapper.
 *
 * Score every (source, target) pair, then resolve conflicts by greedy
 * highest-score-first assignment. Each source column maps to at most one
 * target field, and each target field is filled by at most one source.
 *
 * This is the **primary** code path. AI in `map-ai.ts` only fills slots this
 * function leaves empty.
 */

import { score, type Score } from "./match.js";
import type {
  FieldMapInput,
  FieldMapResult,
  FieldMapping,
} from "./types.js";

interface Candidate extends Score {
  source: string;
  target: string;
}

export function mapFields(input: FieldMapInput): FieldMapResult {
  const candidates: Candidate[] = [];
  for (const src of input.sourceColumns) {
    for (const tgt of input.targetSchema) {
      const s = score(src, tgt);
      if (s.method !== "none") {
        candidates.push({ source: src, target: tgt.name, ...s });
      }
    }
  }

  // Sort highest score first. Method-precedence is the tiebreak.
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return methodRank(a.method) - methodRank(b.method);
  });

  const usedSources = new Set<string>();
  const usedTargets = new Set<string>();
  const mappings: FieldMapping[] = [];
  for (const c of candidates) {
    if (usedSources.has(c.source) || usedTargets.has(c.target)) continue;
    if (c.method === "none") continue;
    mappings.push({
      source: c.source,
      target: c.target,
      score: c.score,
      method: c.method,
    });
    usedSources.add(c.source);
    usedTargets.add(c.target);
  }

  const unmappedSource = input.sourceColumns.filter(
    (s) => !usedSources.has(s),
  );
  const unmappedTarget = input.targetSchema
    .map((t) => t.name)
    .filter((t) => !usedTargets.has(t));

  // Stable order: original source order.
  mappings.sort(
    (a, b) =>
      input.sourceColumns.indexOf(a.source) -
      input.sourceColumns.indexOf(b.source),
  );

  return { mappings, unmappedSource, unmappedTarget };
}

function methodRank(m: Candidate["method"]): number {
  switch (m) {
    case "exact":
      return 0;
    case "synonym":
      return 1;
    case "token":
      return 2;
    case "edit":
      return 3;
    case "ai":
      return 4;
    case "none":
      return 5;
  }
}

export { score };
