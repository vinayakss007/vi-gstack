import { describe, expect, it } from "vitest";
import { recommend } from "../src/charts/recommend.js";

describe("deterministic chart recommender", () => {
  it("picks line for a single-numeric time series", () => {
    const r = recommend({
      columns: [
        { name: "ts", kind: "temporal" },
        { name: "value", kind: "numeric" },
      ],
    });
    expect(r.chart).toBe("line");
    expect(r.encoding.x).toBe("ts");
    expect(r.encoding.y).toBe("value");
    expect(r.rule).toBe("time-series-single");
  });

  it("picks multi-line when one temporal and many numerics", () => {
    const r = recommend({
      columns: [
        { name: "ts", kind: "temporal" },
        { name: "a", kind: "numeric" },
        { name: "b", kind: "numeric" },
        { name: "c", kind: "numeric" },
      ],
    });
    expect(r.chart).toBe("multi-line");
    expect(r.rule).toBe("time-series-multi");
  });

  it("picks multi-line split by category for time series with category", () => {
    const r = recommend({
      columns: [
        { name: "ts", kind: "temporal" },
        { name: "rev", kind: "numeric" },
        { name: "region", kind: "categorical", distinctCount: 5 },
      ],
    });
    expect(r.chart).toBe("multi-line");
    expect(r.encoding.series).toBe("region");
  });

  it("picks histogram for a single numeric distribution", () => {
    const r = recommend({
      columns: [{ name: "latency_ms", kind: "numeric" }],
    });
    expect(r.chart).toBe("histogram");
  });

  it("picks scatter for two numerics", () => {
    const r = recommend({
      columns: [
        { name: "x", kind: "numeric" },
        { name: "y", kind: "numeric" },
      ],
    });
    expect(r.chart).toBe("scatter");
  });

  it("picks bar with pie-allowed reason for low-cardinality categorical", () => {
    const r = recommend({
      columns: [
        { name: "tier", kind: "categorical", distinctCount: 4 },
        { name: "users", kind: "numeric" },
      ],
    });
    expect(r.chart).toBe("bar");
    expect(r.reason.toLowerCase()).toContain("pie");
  });

  it("picks bar for typical categorical-vs-numeric", () => {
    const r = recommend({
      columns: [
        { name: "country", kind: "categorical", distinctCount: 20 },
        { name: "users", kind: "numeric" },
      ],
    });
    expect(r.chart).toBe("bar");
    expect(r.rule).toBe("categorical-vs-numeric");
  });

  it("warns when categorical cardinality is high", () => {
    const r = recommend({
      columns: [
        { name: "city", kind: "categorical", distinctCount: 500 },
        { name: "users", kind: "numeric" },
      ],
    });
    expect(r.chart).toBe("bar");
    expect(r.reason.toLowerCase()).toContain("top");
  });

  it("picks grouped-bar for two categoricals + one numeric", () => {
    const r = recommend({
      columns: [
        { name: "country", kind: "categorical", distinctCount: 20 },
        { name: "tier", kind: "categorical", distinctCount: 3 },
        { name: "users", kind: "numeric" },
      ],
    });
    expect(r.chart).toBe("grouped-bar");
    // The lower-cardinality column should be the series.
    expect(r.encoding.series).toBe("tier");
  });

  it("falls back to a table when nothing matches", () => {
    const r = recommend({
      columns: [
        { name: "id1", kind: "high-cardinality" },
        { name: "id2", kind: "high-cardinality" },
      ],
    });
    expect(r.chart).toBe("table");
    expect(r.rule).toBe("fallback-table");
  });

  it("returns a confidence in [0, 1]", () => {
    const r = recommend({
      columns: [
        { name: "ts", kind: "temporal" },
        { name: "value", kind: "numeric" },
      ],
    });
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });
});
