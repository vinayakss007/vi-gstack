/**
 * Deterministic narrator.
 *
 * Takes an InsightInput, computes statistics, and emits an array of
 * structured insights. Each insight carries both a deterministic English
 * `text` and a `facts` map with the load-bearing numbers. The AI-augmented
 * narrator is only allowed to rewrite `text`. The numbers in `facts` are
 * the truth.
 *
 * This is the **primary** code path. It runs on every request and never
 * calls AI. With AI_ENABLED=false the product is fully featured.
 */

import {
  bottomN,
  outlierIndices,
  summarize,
  topN,
  trend,
} from "./stats.js";
import type { Insight, InsightInput, InsightOutput } from "./types.js";

const TOP_N = 3;
const MAX_OUTLIERS_NAMED = 3;

export function narrate(input: InsightInput): InsightOutput {
  const insights: Insight[] = [];
  if (input.values.length === 0) {
    return { metric: input.metric, insights };
  }

  const s = summarize(input.values);
  const t = trend(input.values);
  const labels = input.labels;

  if (labels && labels.length !== input.values.length) {
    throw new Error("narrate: labels and values must have the same length");
  }

  // 1. Summary
  insights.push({
    kind: "summary",
    text: `${input.metric} averaged ${fmt(s.mean)} across ${s.count} ${noun(s.count)} (range ${fmt(s.min)}–${fmt(s.max)}).`,
    facts: {
      metric: input.metric,
      count: s.count,
      mean: round(s.mean),
      median: round(s.median),
      stddev: round(s.stddev),
      min: s.min,
      max: s.max,
    },
  });

  // 2. Trend (only if there are at least 3 points and direction is not flat)
  if (input.values.length >= 3 && t.direction !== "flat") {
    const r2 = Number.isNaN(t.r2) ? 0 : Math.max(0, Math.min(1, t.r2));
    insights.push({
      kind: "trend",
      text: `Trend across the sequence is ${t.direction} (~${fmt(Math.abs(t.slope))} per step, R²=${r2.toFixed(2)}).`,
      facts: {
        direction: t.direction,
        slopePerStep: round(t.slope),
        r2: round(r2),
      },
    });
  }

  // 3 & 4. Top and bottom (only when labels are provided)
  if (labels && labels.length === input.values.length) {
    const top = topN(input.values, labels, Math.min(TOP_N, input.values.length));
    const bot = bottomN(
      input.values,
      labels,
      Math.min(TOP_N, input.values.length),
    );
    if (top.length > 0) {
      insights.push({
        kind: "top",
        text: `Highest: ${fmt(top[0]!.value)} at ${top[0]!.label}${top.length > 1 ? `, then ${top[1]!.label} (${fmt(top[1]!.value)})` : ""}.`,
        facts: {
          topLabel: top[0]!.label,
          topValue: top[0]!.value,
          ...(top[1]
            ? { secondLabel: top[1]!.label, secondValue: top[1]!.value }
            : {}),
        },
      });
    }
    if (bot.length > 0 && bot[0]!.label !== top[0]?.label) {
      insights.push({
        kind: "bottom",
        text: `Lowest: ${fmt(bot[0]!.value)} at ${bot[0]!.label}.`,
        facts: { bottomLabel: bot[0]!.label, bottomValue: bot[0]!.value },
      });
    }
  }

  // 5. Outliers
  const outliers = outlierIndices(input.values);
  if (outliers.length > 0) {
    const named = outliers
      .slice(0, MAX_OUTLIERS_NAMED)
      .map((i) => {
        const v = input.values[i]!;
        const lbl = labels?.[i];
        return lbl ? `${lbl} (${fmt(v)})` : fmt(v);
      })
      .join(", ");
    const more = outliers.length > MAX_OUTLIERS_NAMED ? ` and ${outliers.length - MAX_OUTLIERS_NAMED} more` : "";
    insights.push({
      kind: "outliers",
      text: `${outliers.length} outlier${outliers.length === 1 ? "" : "s"} flagged: ${named}${more}.`,
      facts: {
        count: outliers.length,
        indices: JSON.stringify(outliers),
      },
    });
  }

  return { metric: input.metric, insights };
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + "K";
  if (Number.isInteger(n)) return n.toString();
  if (abs < 1) return n.toFixed(3);
  return n.toFixed(2);
}

function round(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 10000) / 10000;
}

function noun(n: number): string {
  return n === 1 ? "point" : "points";
}
