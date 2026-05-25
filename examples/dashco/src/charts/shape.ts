/**
 * Data-shape primitives.
 *
 * The deterministic chart recommender consumes a `DataShape` and returns a
 * `ChartRecommendation`. AI never sees raw data — only the shape — which keeps
 * AI off the hot path and avoids leaking customer data to providers.
 */

export type ColumnKind =
  | "temporal" // dates, datetimes, timestamps
  | "numeric" // ints, floats
  | "categorical" // bounded set of string labels
  | "high-cardinality" // free-text strings, IDs
  | "boolean";

export interface ColumnShape {
  name: string;
  kind: ColumnKind;
  /** Number of distinct values, when known. Used for cardinality heuristics. */
  distinctCount?: number;
  /** Total non-null rows, when known. */
  rowCount?: number;
}

export interface DataShape {
  columns: ColumnShape[];
}

export type ChartType =
  | "line"
  | "multi-line"
  | "bar"
  | "grouped-bar"
  | "stacked-bar"
  | "scatter"
  | "histogram"
  | "pie"
  | "table";

export interface ChartRecommendation {
  chart: ChartType;
  /** Which columns map to which channels. */
  encoding: Partial<{
    x: string;
    y: string;
    series: string;
    color: string;
  }>;
  /**
   * Confidence in the deterministic pick, 0..1. AI must not lower this.
   * Kept for telemetry; the routing decision itself is binary (rule fires or
   * it doesn't).
   */
  confidence: number;
  /** Plain-English reason. Deterministic by default, AI may overwrite. */
  reason: string;
  /** Which heuristic fired, for auditability. */
  rule: string;
}
