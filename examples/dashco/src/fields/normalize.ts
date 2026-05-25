/**
 * Pure string-shape utilities for column-name matching.
 *
 * All functions are deterministic, side-effect free, and tested in isolation.
 */

import { canonicalize } from "./synonyms.js";

/**
 * Lowercase, strip non-alphanumeric. The most aggressive form of equality.
 *   "Order Date"   -> "orderdate"
 *   "order_date"   -> "orderdate"
 *   "OrderDate"    -> "orderdate"
 *   "Order #Date!" -> "orderdate"
 */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Split a column name into lowercase tokens. Handles snake_case, kebab-case,
 * camelCase, PascalCase, spaces, and punctuation. Numbers are kept as their
 * own tokens.
 *
 *   "OrderDate"    -> ["order", "date"]
 *   "order_date"   -> ["order", "date"]
 *   "Total $ USD"  -> ["total", "usd"]
 *   "qty2"         -> ["qty", "2"]
 */
export function tokenize(s: string): string[] {
  // Insert a separator at camelCase boundaries first.
  const withSep = s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return withSep
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0);
}

/** Tokens with synonyms collapsed to canonical form. Stable order, deduped. */
export function canonicalTokens(s: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of tokenize(s)) {
    const c = canonicalize(tok);
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/** Jaccard similarity over two token sets. 0..1. */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let intersect = 0;
  for (const x of sa) if (sb.has(x)) intersect++;
  const unionSize = sa.size + sb.size - intersect;
  return intersect / unionSize;
}

/**
 * Standard Levenshtein edit distance. O(n*m). Fine for short column names.
 */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1,
        prev[j]! + 1,
        prev[j - 1]! + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/** Edit similarity in [0, 1]: 1 - distance / maxLen. */
export function editSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}
