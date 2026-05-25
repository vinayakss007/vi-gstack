# AI usage policy

**AI is not load-bearing.** The product must work fully with `AI_ENABLED=false`.

## Allowed AI uses

1. **Chart-type recommendation** given a data shape — augmentation only,
   deterministic algorithm always wins on disagreement.
2. **Field-mapping hints** — suggesting how an uploaded CSV's columns map to a
   known schema. Deterministic exact-match + fuzzy-match runs first; AI only
   suggests for unmatched columns.
3. **Schema classification hints** — suggesting what kind of dataset this is
   (sales, web analytics, finance…). Deterministic keyword classifier runs
   first; AI is a tiebreaker.
4. **Short narrative insight bullets** — turning a deterministic statistical
   summary (mean, trend, outliers) into 1–3 sentence English bullets. The
   numbers are deterministic; AI only writes prose around them.

## Forbidden AI uses

- Layout selection
- Color choice
- Anomaly detection
- Forecasting
- Aggregation choice (sum vs avg vs count etc.)
- Natural-language to SQL
- Natural-language to dashboard
- Anything on a request hot path

These must be deterministic algorithms.

## Architectural rules

- Single gateway: `src/ai/gateway.ts`. No direct provider SDK imports
  elsewhere.
- All AI responses are validated against a Zod schema. Invalid responses are
  treated as a provider failure and the deterministic fallback returns.
- Silent fallback: AI failures never surface as errors to the caller. They are
  logged and the deterministic result returns.
- Toggles: `AI_ENABLED` (env, global) AND a per-customer toggle (not yet wired
  in the skeleton — see `src/env.ts` for the global flag).
- Disagreement resolution: when AI and deterministic disagree on a chart pick,
  deterministic wins. The disagreement is logged for human review.

## Verification

Run `bun test` with `AI_ENABLED=false` (default). Every test must pass. This is
the load-bearing proof that AI is not load-bearing.
