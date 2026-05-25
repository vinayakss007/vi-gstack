import { describe, expect, it } from "vitest";
import {
  bottomN,
  outlierIndices,
  summarize,
  topN,
  trend,
} from "../src/insights/stats.js";
import { narrate } from "../src/insights/narrate.js";
import { narrateWithAI } from "../src/insights/narrate-ai.js";

describe("deterministic statistics", () => {
  it("summarize computes count, sum, mean, median, min, max, stddev", () => {
    const s = summarize([1, 2, 3, 4, 5]);
    expect(s.count).toBe(5);
    expect(s.sum).toBe(15);
    expect(s.mean).toBe(3);
    expect(s.median).toBe(3);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
    expect(s.stddev).toBeCloseTo(Math.sqrt(2), 5);
  });

  it("median averages the two middles for even-length", () => {
    expect(summarize([1, 2, 3, 4]).median).toBe(2.5);
  });

  it("summarize throws on empty", () => {
    expect(() => summarize([])).toThrow();
  });

  it("trend detects upward direction with positive slope", () => {
    const t = trend([1, 2, 3, 4, 5, 6]);
    expect(t.direction).toBe("up");
    expect(t.slope).toBeCloseTo(1, 5);
    expect(t.r2).toBeCloseTo(1, 5);
  });

  it("trend detects downward direction", () => {
    const t = trend([10, 8, 6, 4, 2]);
    expect(t.direction).toBe("down");
    expect(t.slope).toBeLessThan(0);
  });

  it("trend stays flat on constant data", () => {
    const t = trend([5, 5, 5, 5, 5]);
    expect(t.direction).toBe("flat");
    expect(t.slope).toBe(0);
  });

  it("trend handles single value gracefully", () => {
    const t = trend([42]);
    expect(t.direction).toBe("flat");
    expect(t.intercept).toBe(42);
  });

  it("topN returns highest values, stable on ties", () => {
    const r = topN([10, 30, 30, 20], ["a", "b", "c", "d"], 2);
    expect(r[0]).toEqual({ label: "b", value: 30 });
    expect(r[1]).toEqual({ label: "c", value: 30 });
  });

  it("bottomN returns lowest values, stable on ties", () => {
    const r = bottomN([10, 30, 5, 20], ["a", "b", "c", "d"], 2);
    expect(r[0]).toEqual({ label: "c", value: 5 });
    expect(r[1]).toEqual({ label: "a", value: 10 });
  });

  it("topN throws on length mismatch", () => {
    expect(() => topN([1, 2], ["a"], 1)).toThrow();
  });

  it("outlierIndices flags IQR outliers", () => {
    // 100 is far above the others; should be flagged.
    const out = outlierIndices([1, 2, 3, 4, 5, 6, 100]);
    expect(out).toContain(6);
  });

  it("outlierIndices returns empty when all values are equal", () => {
    expect(outlierIndices([5, 5, 5, 5])).toEqual([]);
  });

  it("outlierIndices returns empty for tiny inputs", () => {
    expect(outlierIndices([1, 2, 3])).toEqual([]);
  });
});

describe("deterministic narrate", () => {
  it("emits a summary insight always", () => {
    const out = narrate({ metric: "revenue", values: [10, 20, 30] });
    expect(out.metric).toBe("revenue");
    expect(out.insights[0]?.kind).toBe("summary");
    expect(out.insights[0]?.facts.mean).toBe(20);
    expect(out.insights[0]?.facts.min).toBe(10);
    expect(out.insights[0]?.facts.max).toBe(30);
  });

  it("emits a trend insight for upward time series", () => {
    const out = narrate({
      metric: "monthly revenue",
      values: [10, 20, 30, 40, 50, 60],
    });
    const trendInsight = out.insights.find((i) => i.kind === "trend");
    expect(trendInsight).toBeDefined();
    expect(trendInsight?.facts.direction).toBe("up");
  });

  it("does not emit trend for flat data", () => {
    const out = narrate({
      metric: "uptime",
      values: [99.9, 99.9, 99.9, 99.9, 99.9, 99.9],
    });
    expect(out.insights.find((i) => i.kind === "trend")).toBeUndefined();
  });

  it("emits top and bottom insights when labels are provided", () => {
    const out = narrate({
      metric: "revenue by region",
      values: [100, 50, 200, 75],
      labels: ["NA", "EU", "APAC", "LATAM"],
    });
    const top = out.insights.find((i) => i.kind === "top");
    const bot = out.insights.find((i) => i.kind === "bottom");
    expect(top?.facts.topLabel).toBe("APAC");
    expect(top?.facts.topValue).toBe(200);
    expect(bot?.facts.bottomLabel).toBe("EU");
    expect(bot?.facts.bottomValue).toBe(50);
  });

  it("does not emit top/bottom when labels are absent", () => {
    const out = narrate({ metric: "values", values: [1, 2, 3, 4, 5] });
    expect(out.insights.find((i) => i.kind === "top")).toBeUndefined();
    expect(out.insights.find((i) => i.kind === "bottom")).toBeUndefined();
  });

  it("emits an outlier insight when IQR fences are exceeded", () => {
    const out = narrate({
      metric: "latency_ms",
      values: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 1000],
    });
    const outliers = out.insights.find((i) => i.kind === "outliers");
    expect(outliers).toBeDefined();
    expect(outliers?.facts.count).toBe(1);
  });

  it("handles empty input by returning no insights", () => {
    const out = narrate({ metric: "x", values: [] });
    expect(out.insights).toEqual([]);
  });

  it("throws on labels/values length mismatch", () => {
    expect(() =>
      narrate({ metric: "x", values: [1, 2, 3], labels: ["a"] }),
    ).toThrow();
  });

  it("every insight carries facts", () => {
    const out = narrate({
      metric: "revenue",
      values: [100, 50, 200, 75, 300, 80],
      labels: ["a", "b", "c", "d", "e", "f"],
    });
    for (const i of out.insights) {
      expect(i.facts).toBeTypeOf("object");
      expect(Object.keys(i.facts).length).toBeGreaterThan(0);
    }
  });
});

describe("AI-augmented narrate with AI_ENABLED=false", () => {
  it("returns the deterministic result unchanged", async () => {
    const input = {
      metric: "revenue",
      values: [10, 20, 30, 40, 50],
      labels: ["jan", "feb", "mar", "apr", "may"],
    };
    const det = narrate(input);
    const aug = await narrateWithAI(input);
    expect(aug.source).toBe("fallback");
    expect(aug.value).toEqual(det);
  });

  it("preserves facts (the load-bearing numbers)", async () => {
    const aug = await narrateWithAI({
      metric: "revenue",
      values: [10, 20, 30, 40, 50],
    });
    const summary = aug.value.insights.find((i) => i.kind === "summary");
    expect(summary?.facts.mean).toBe(30);
    expect(summary?.facts.min).toBe(10);
    expect(summary?.facts.max).toBe(50);
  });

  it("never throws on empty input", async () => {
    const aug = await narrateWithAI({ metric: "x", values: [] });
    expect(aug.source).toBe("fallback");
    expect(aug.value.insights).toEqual([]);
  });
});
