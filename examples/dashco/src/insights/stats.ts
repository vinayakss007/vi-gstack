/**
 * Pure deterministic statistics. Reusable, side-effect free, no AI.
 *
 * These functions are the single source of truth for the numbers in every
 * insight. AI prose around an insight may change, but the numbers come from
 * here.
 */

export interface Summary {
  count: number;
  sum: number;
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
}

/** Population stats (not sample). Throws on empty input. */
export function summarize(values: readonly number[]): Summary {
  if (values.length === 0) {
    throw new Error("summarize: values is empty");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / count;
  let sqSum = 0;
  for (const v of values) sqSum += (v - mean) * (v - mean);
  const stddev = Math.sqrt(sqSum / count);
  return {
    count,
    sum,
    mean,
    median: median(sorted),
    stddev,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

/** Standard sorted-array median. */
function median(sortedAsc: readonly number[]): number {
  const n = sortedAsc.length;
  if (n === 0) return Number.NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 0
    ? (sortedAsc[mid - 1]! + sortedAsc[mid]!) / 2
    : sortedAsc[mid]!;
}

export interface Trend {
  /** Linear regression slope: change in y per unit step in x (positional index). */
  slope: number;
  intercept: number;
  /** Coefficient of determination, 0..1. NaN if values are constant. */
  r2: number;
  direction: "up" | "down" | "flat";
}

/**
 * Least-squares linear regression treating `values` as y and the position
 * index 0..n-1 as x. Returns slope, intercept, and R² for confidence.
 *
 * `direction` is "flat" when |slope| is below a tiny epsilon relative to the
 * value scale — this avoids declaring a trend on numerical noise.
 */
export function trend(values: readonly number[]): Trend {
  const n = values.length;
  if (n < 2) {
    return { slope: 0, intercept: values[0] ?? 0, r2: Number.NaN, direction: "flat" };
  }
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² = 1 - SS_res / SS_tot.
  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const y = values[i]!;
    const yHat = slope * i + intercept;
    ssRes += (y - yHat) * (y - yHat);
    ssTot += (y - meanY) * (y - meanY);
  }
  const r2 = ssTot === 0 ? Number.NaN : 1 - ssRes / ssTot;

  // Flat threshold: slope must move the line by at least 1% of the value range
  // across the whole sequence to count as a trend.
  const range = Math.max(...values) - Math.min(...values);
  const flatThreshold = (range || Math.abs(meanY) || 1) * 0.01 / Math.max(1, n - 1);
  let direction: Trend["direction"] = "flat";
  if (slope > flatThreshold) direction = "up";
  else if (slope < -flatThreshold) direction = "down";

  return { slope, intercept, r2, direction };
}

export interface RankedItem {
  label: string;
  value: number;
}

/** Top n by value descending. Stable on ties (preserves input order). */
export function topN(
  values: readonly number[],
  labels: readonly string[],
  n: number,
): RankedItem[] {
  return rank(values, labels, n, (a, b) => b - a);
}

/** Bottom n by value ascending. Stable on ties (preserves input order). */
export function bottomN(
  values: readonly number[],
  labels: readonly string[],
  n: number,
): RankedItem[] {
  return rank(values, labels, n, (a, b) => a - b);
}

function rank(
  values: readonly number[],
  labels: readonly string[],
  n: number,
  cmp: (a: number, b: number) => number,
): RankedItem[] {
  if (values.length !== labels.length) {
    throw new Error("rank: values and labels must have the same length");
  }
  const items: { label: string; value: number; idx: number }[] = values.map(
    (v, i) => ({ label: labels[i]!, value: v, idx: i }),
  );
  items.sort((a, b) => {
    const c = cmp(a.value, b.value);
    return c !== 0 ? c : a.idx - b.idx;
  });
  return items
    .slice(0, n)
    .map((it) => ({ label: it.label, value: it.value }));
}

/** Indices of values flagged as outliers using the IQR fence rule (1.5×IQR). */
export function outlierIndices(values: readonly number[]): number[] {
  const n = values.length;
  if (n < 4) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return [];
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = values[i]!;
    if (v < low || v > high) out.push(i);
  }
  return out;
}

function quantile(sortedAsc: readonly number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return Number.NaN;
  const pos = (n - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = pos - lo;
  return sortedAsc[lo]! * (1 - frac) + sortedAsc[hi]! * frac;
}
