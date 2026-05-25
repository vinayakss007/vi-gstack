import { describe, expect, it } from "vitest";
import { recommendWithAI } from "../src/charts/recommend-ai.js";
import { recommend } from "../src/charts/recommend.js";

/**
 * The gateway tests prove the policy: the product fully ships with AI
 * disabled. Vitest sets `AI_ENABLED=false` in `vitest.config.ts`, so every
 * call here exercises the deterministic fallback.
 */
describe("ai gateway with AI_ENABLED=false (default for tests)", () => {
  it("returns the deterministic result for chart recommendation", async () => {
    const shape = {
      columns: [
        { name: "ts", kind: "temporal" as const },
        { name: "value", kind: "numeric" as const },
      ],
    };
    const det = recommend(shape);
    const aug = await recommendWithAI(shape);

    expect(aug.source).toBe("fallback");
    expect(aug.reason).toBe("ai-disabled");
    expect(aug.value).toEqual(det);
  });

  it("does not throw on any input shape (silent fallback)", async () => {
    // Even a shape that hits the table fallback should not throw.
    const aug = await recommendWithAI({
      columns: [
        { name: "id", kind: "high-cardinality" as const },
        { name: "id2", kind: "high-cardinality" as const },
      ],
    });
    expect(aug.value.chart).toBe("table");
    expect(aug.source).toBe("fallback");
  });
});
