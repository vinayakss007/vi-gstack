import { describe, expect, it } from "vitest";
import {
  canonicalTokens,
  editDistance,
  editSimilarity,
  jaccard,
  normalize,
  tokenize,
} from "../src/fields/normalize.js";
import { score } from "../src/fields/match.js";
import { mapFields } from "../src/fields/map.js";
import { mapFieldsWithAI } from "../src/fields/map-ai.js";
import type { TargetField } from "../src/fields/types.js";

const SCHEMA: TargetField[] = [
  { name: "date", aliases: ["order_date"] },
  { name: "revenue" },
  { name: "customer_id", aliases: ["customer", "user_id"] },
  { name: "product" },
  { name: "quantity" },
  { name: "country" },
];

describe("normalize / tokenize / similarity", () => {
  it("normalize strips punctuation and case", () => {
    expect(normalize("Order Date")).toBe("orderdate");
    expect(normalize("order_date")).toBe("orderdate");
    expect(normalize("OrderDate")).toBe("orderdate");
    expect(normalize("Order #Date!")).toBe("orderdate");
  });

  it("tokenize splits camelCase, snake_case, kebab-case, spaces", () => {
    expect(tokenize("OrderDate")).toEqual(["order", "date"]);
    expect(tokenize("order_date")).toEqual(["order", "date"]);
    expect(tokenize("order-date")).toEqual(["order", "date"]);
    expect(tokenize("Order Date")).toEqual(["order", "date"]);
    expect(tokenize("ORDDate")).toEqual(["ord", "date"]);
  });

  it("canonicalTokens collapses synonyms", () => {
    expect(canonicalTokens("Total $")).toEqual(["revenue"]);
    expect(canonicalTokens("qty")).toEqual(["quantity"]);
    // 'order' is not a synonym; it stays as its own token.
    expect(canonicalTokens("OrderDate")).toEqual(["order", "date"]);
  });

  it("jaccard handles empty inputs", () => {
    expect(jaccard([], [])).toBe(1);
    expect(jaccard(["a"], [])).toBe(0);
    expect(jaccard([], ["a"])).toBe(0);
  });

  it("jaccard computes intersection over union", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(1);
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3, 5);
  });

  it("editDistance is the standard Levenshtein", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("editSimilarity is in [0, 1]", () => {
    expect(editSimilarity("abc", "abc")).toBe(1);
    expect(editSimilarity("abc", "xyz")).toBe(0);
  });
});

describe("deterministic field scorer", () => {
  it("exact normalized match scores 1.0", () => {
    const r = score("Order Date", { name: "order_date" });
    expect(r.method).toBe("exact");
    expect(r.score).toBe(1.0);
  });

  it("synonym match via canonicalized tokens", () => {
    const r = score("Total $", { name: "revenue" });
    expect(r.method).toBe("synonym");
    expect(r.score).toBe(0.92);
  });

  it("token Jaccard above threshold (partial overlap, no synonym equality)", () => {
    // canonical(event_date) = ["event", "date"]; canonical(date) = ["date"].
    // Jaccard = 1/2 = 0.5, above the 0.34 threshold.
    const r = score("event_date", { name: "date" });
    expect(r.method).toBe("token");
    expect(r.score).toBeGreaterThan(0.34);
  });

  it("edit-similarity covers near-typos", () => {
    const r = score("revenue", { name: "revenuee" });
    expect(r.method).toBe("edit");
    expect(r.score).toBeGreaterThanOrEqual(0.75);
  });

  it("nothing fires for unrelated names", () => {
    const r = score("zip", { name: "revenue" });
    expect(r.method).toBe("none");
  });
});

describe("deterministic mapFields", () => {
  it("maps a typical sales CSV with messy column names", () => {
    const r = mapFields({
      sourceColumns: [
        "Order Date",
        "Total $",
        "Cust ID",
        "SKU",
        "Qty",
        "Country",
      ],
      targetSchema: SCHEMA,
    });

    const byTarget = Object.fromEntries(
      r.mappings.map((m) => [m.target, m.source]),
    );
    expect(byTarget["date"]).toBe("Order Date");
    expect(byTarget["revenue"]).toBe("Total $");
    expect(byTarget["customer_id"]).toBe("Cust ID");
    expect(byTarget["product"]).toBe("SKU");
    expect(byTarget["quantity"]).toBe("Qty");
    expect(byTarget["country"]).toBe("Country");
    expect(r.unmappedSource).toEqual([]);
    expect(r.unmappedTarget).toEqual([]);
  });

  it("never assigns a target twice", () => {
    const r = mapFields({
      sourceColumns: ["revenue", "Total $"],
      targetSchema: [{ name: "revenue" }],
    });
    expect(r.mappings).toHaveLength(1);
    // Exact normalized match wins over synonym.
    expect(r.mappings[0]?.source).toBe("revenue");
    expect(r.unmappedSource).toEqual(["Total $"]);
  });

  it("leaves columns with no signal unmapped", () => {
    const r = mapFields({
      sourceColumns: ["mystery_column_xyz"],
      targetSchema: SCHEMA,
    });
    expect(r.mappings).toEqual([]);
    expect(r.unmappedSource).toEqual(["mystery_column_xyz"]);
  });

  it("records the method on every mapping", () => {
    const r = mapFields({
      sourceColumns: ["Order Date", "Total $", "Cust ID"],
      targetSchema: SCHEMA,
    });
    for (const m of r.mappings) {
      expect(["exact", "synonym", "token", "edit"]).toContain(m.method);
      expect(m.score).toBeGreaterThan(0);
      expect(m.score).toBeLessThanOrEqual(1);
    }
  });

  it("preserves source order in the output", () => {
    const r = mapFields({
      sourceColumns: ["country", "revenue", "date"],
      targetSchema: SCHEMA,
    });
    expect(r.mappings.map((m) => m.source)).toEqual([
      "country",
      "revenue",
      "date",
    ]);
  });
});

describe("AI-augmented mapFields with AI_ENABLED=false", () => {
  it("returns the deterministic result unchanged", async () => {
    const input = {
      sourceColumns: ["Order Date", "Total $", "Qty"],
      targetSchema: SCHEMA,
    };
    const det = mapFields(input);
    const aug = await mapFieldsWithAI(input);
    expect(aug.source).toBe("fallback");
    expect(aug.value).toEqual(det);
  });

  it("never throws even with no possible mappings", async () => {
    const aug = await mapFieldsWithAI({
      sourceColumns: ["x", "y"],
      targetSchema: [{ name: "abc" }, { name: "def" }],
    });
    expect(aug.source).toBe("fallback");
    expect(aug.value.mappings).toEqual([]);
  });
});
