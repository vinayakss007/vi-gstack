/**
 * Score a single (source column name, target schema field) pair using four
 * deterministic methods, in order of decreasing precision. The first method
 * to clear its threshold wins, with the strongest signal kept.
 *
 *   1. exact      - normalized strings match exactly                  (1.00)
 *   2. synonym    - canonicalized token sets are equal                (0.92)
 *   3. token      - Jaccard over canonicalized tokens >= 0.34         (jaccard)
 *   4. edit       - edit-similarity over normalized strings >= 0.75   (editSim)
 *
 * Returning method "none" with a numeric score means "below threshold but
 * usable as a sanity floor for AI proposals."
 */

import {
  canonicalTokens,
  editSimilarity,
  jaccard,
  normalize,
} from "./normalize.js";
import type { TargetField, MatchMethod } from "./types.js";

export interface Score {
  score: number;
  method: MatchMethod | "none";
}

const TOKEN_THRESHOLD = 0.34;
const EDIT_THRESHOLD = 0.75;

export function score(source: string, target: TargetField): Score {
  const sNorm = normalize(source);
  const targets = [target.name, ...(target.aliases ?? [])];

  // 1. Exact normalized match against name or any alias.
  for (const candidate of targets) {
    if (normalize(candidate) === sNorm) {
      return { score: 1.0, method: "exact" };
    }
  }

  const sToks = canonicalTokens(source);
  for (const candidate of targets) {
    const cToks = canonicalTokens(candidate);
    // 2. Canonicalized token sets equal => synonym match.
    if (
      sToks.length > 0 &&
      cToks.length === sToks.length &&
      cToks.every((t) => sToks.includes(t))
    ) {
      return { score: 0.92, method: "synonym" };
    }
  }

  // 3. Token Jaccard over the best candidate.
  let bestJ = 0;
  for (const candidate of targets) {
    bestJ = Math.max(bestJ, jaccard(sToks, canonicalTokens(candidate)));
  }
  if (bestJ >= TOKEN_THRESHOLD) {
    return { score: bestJ, method: "token" };
  }

  // 4. Edit similarity over normalized strings.
  let bestE = 0;
  for (const candidate of targets) {
    bestE = Math.max(bestE, editSimilarity(sNorm, normalize(candidate)));
  }
  if (bestE >= EDIT_THRESHOLD) {
    return { score: bestE, method: "edit" };
  }

  // No method cleared its threshold. Return the best raw similarity for
  // sanity-floor checks against AI proposals - but with method "none" so
  // the matcher won't promote it.
  return { score: Math.max(bestJ, bestE), method: "none" };
}
