/**
 * Deterministic chart-type recommender.
 *
 * This is the **primary** code path. It runs on every request and never calls
 * AI. The AI-augmented wrapper in `recommend-ai.ts` may add prose around this
 * result but cannot change which chart was picked.
 *
 * Heuristics encoded here are standard data-viz practice (Cleveland, Wilkinson,
 * Munzner). The order matters: more specific rules run first.
 */

import type {
  ChartRecommendation,
  ChartType,
  ColumnShape,
  DataShape,
} from "./shape.js";

const PIE_MAX_SLICES = 6;
const HIGH_CATEGORICAL_BAR = 30;

export function recommend(shape: DataShape): ChartRecommendation {
  const cols = shape.columns;
  const temporal = cols.filter((c) => c.kind === "temporal");
  const numeric = cols.filter((c) => c.kind === "numeric");
  const categorical = cols.filter((c) => c.kind === "categorical");
  const boolean = cols.filter((c) => c.kind === "boolean");

  // Rule 1: time series — one temporal axis with one numeric, no breakdown.
  if (
    temporal.length === 1 &&
    numeric.length === 1 &&
    categorical.length === 0
  ) {
    return rec("line", "time-series-single", 0.95, {
      x: temporal[0]!.name,
      y: numeric[0]!.name,
    });
  }

  // Rule 2: multi-series time series — one temporal, multiple numerics.
  if (temporal.length === 1 && numeric.length >= 2 && categorical.length === 0) {
    return rec("multi-line", "time-series-multi", 0.9, {
      x: temporal[0]!.name,
      y: numeric[0]!.name,
    });
  }

  // Rule 3: time series broken down by a category.
  if (temporal.length === 1 && numeric.length === 1 && categorical.length >= 1) {
    const series = pickLowestCardinality(categorical);
    return rec("multi-line", "time-series-by-category", 0.88, {
      x: temporal[0]!.name,
      y: numeric[0]!.name,
      series: series.name,
    });
  }

  // Rule 4: single numeric distribution.
  if (numeric.length === 1 && categorical.length === 0 && temporal.length === 0) {
    return rec("histogram", "single-numeric-distribution", 0.9, {
      x: numeric[0]!.name,
    });
  }

  // Rule 5: two numerics — relationship.
  if (numeric.length === 2 && categorical.length === 0 && temporal.length === 0) {
    return rec("scatter", "two-numeric-relationship", 0.9, {
      x: numeric[0]!.name,
      y: numeric[1]!.name,
    });
  }

  // Rule 6: one categorical + one numeric — the bar/pie decision.
  if (categorical.length === 1 && numeric.length === 1 && temporal.length === 0) {
    const cat = categorical[0]!;
    const distinct = cat.distinctCount ?? Infinity;
    if (distinct <= PIE_MAX_SLICES) {
      // Pie is allowed for small parts-of-whole; bar is still safer. We pick
      // bar and surface pie as an alternative in the reason.
      return rec(
        "bar",
        "categorical-vs-numeric-low-cardinality",
        0.85,
        { x: cat.name, y: numeric[0]!.name },
        `Bar chart with ${distinct} categories. Pie chart is acceptable here as a parts-of-whole alternative.`,
      );
    }
    if (distinct <= HIGH_CATEGORICAL_BAR) {
      return rec("bar", "categorical-vs-numeric", 0.9, {
        x: cat.name,
        y: numeric[0]!.name,
      });
    }
    return rec(
      "bar",
      "categorical-vs-numeric-high-cardinality",
      0.7,
      { x: cat.name, y: numeric[0]!.name },
      `Bar chart with ${distinct} categories. Consider a top-N truncation for readability.`,
    );
  }

  // Rule 7: two categoricals + one numeric — grouped or stacked. The
  // higher-cardinality column gets the x-axis (more bars); the lower-
  // cardinality column becomes the series (color).
  if (categorical.length === 2 && numeric.length === 1 && temporal.length === 0) {
    const [low, high] = sortByCardinality(categorical);
    return rec("grouped-bar", "two-categorical-one-numeric", 0.82, {
      x: high!.name,
      y: numeric[0]!.name,
      series: low!.name,
    });
  }

  // Rule 8: boolean + numeric — bar.
  if (boolean.length === 1 && numeric.length === 1 && temporal.length === 0) {
    return rec("bar", "boolean-vs-numeric", 0.85, {
      x: boolean[0]!.name,
      y: numeric[0]!.name,
    });
  }

  // Fallback: nothing matched cleanly. Show a table — that's always honest.
  return rec("table", "fallback-table", 0.4, {});
}

function rec(
  chart: ChartType,
  rule: string,
  confidence: number,
  encoding: ChartRecommendation["encoding"],
  reasonOverride?: string,
): ChartRecommendation {
  return {
    chart,
    rule,
    confidence,
    encoding,
    reason: reasonOverride ?? defaultReason(chart, encoding),
  };
}

function defaultReason(
  chart: ChartType,
  encoding: ChartRecommendation["encoding"],
): string {
  const x = encoding.x ? `\`${encoding.x}\`` : "x";
  const y = encoding.y ? `\`${encoding.y}\`` : "y";
  switch (chart) {
    case "line":
      return `Line chart of ${y} over ${x}.`;
    case "multi-line":
      return encoding.series
        ? `Multi-line chart of ${y} over ${x}, split by \`${encoding.series}\`.`
        : `Multi-line chart of multiple metrics over ${x}.`;
    case "bar":
      return `Bar chart of ${y} by ${x}.`;
    case "grouped-bar":
      return `Grouped bar chart of ${y} by ${x}, grouped by \`${encoding.series ?? "series"}\`.`;
    case "stacked-bar":
      return `Stacked bar chart of ${y} by ${x}.`;
    case "scatter":
      return `Scatter plot of ${y} vs ${x}.`;
    case "histogram":
      return `Histogram of ${x}.`;
    case "pie":
      return `Pie chart of ${y} by ${x}.`;
    case "table":
      return `No clean chart fits this shape. Showing a table is the honest default.`;
  }
}

function pickLowestCardinality(cols: ColumnShape[]): ColumnShape {
  return sortByCardinality(cols)[0]!;
}

function sortByCardinality(cols: ColumnShape[]): ColumnShape[] {
  return [...cols].sort(
    (a, b) => (a.distinctCount ?? Infinity) - (b.distinctCount ?? Infinity),
  );
}
