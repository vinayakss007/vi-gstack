/**
 * Insight types.
 *
 * The deterministic narrator produces an array of structured `Insight`s.
 * Each insight has both a deterministic `text` (English bullet) and a
 * deterministic `facts` map (the numbers behind the bullet). AI is only
 * allowed to rewrite `text`. The numbers are load-bearing and stay in
 * `facts` where AI cannot touch them.
 */

export interface InsightInput {
  /** What the values represent, e.g. "monthly revenue", "page latency (ms)". */
  metric: string;
  /** The data. Order is meaningful for trend computation. */
  values: number[];
  /**
   * Optional labels with the same length as `values`. When provided, top/bottom
   * insights name the labels (e.g. "Highest: $42K at March"). When absent,
   * top/bottom insights are not generated.
   */
  labels?: string[];
}

export type InsightKind =
  | "summary"
  | "trend"
  | "top"
  | "bottom"
  | "outliers";

export interface Insight {
  kind: InsightKind;
  text: string;
  /**
   * The deterministic numbers behind the text. AI rewrites of `text` cannot
   * change these. Callers that care about the numbers should read them from
   * here, not parse them out of the prose.
   */
  facts: Record<string, number | string>;
}

export interface InsightOutput {
  metric: string;
  insights: Insight[];
}
