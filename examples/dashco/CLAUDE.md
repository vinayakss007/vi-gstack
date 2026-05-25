# dashco

This is a minimal automatic-company starter on top of gstack. When working in
this repo, follow the rules below.

## The non-negotiable rule

**AI is not load-bearing.** Read `policies/AI_USAGE.md` before doing anything
that touches AI. Summary:

- The product must work fully with `AI_ENABLED=false`.
- All AI calls go through `src/ai/gateway.ts`. No direct provider SDK calls
  anywhere else.
- Every AI use must have a deterministic fallback that fully ships.
- AI may *augment* a deterministic result, never *replace* it. Disagreement
  between AI and deterministic always resolves in favor of deterministic.
- No AI on hot paths.

If a proposed change violates any of these, stop and surface it to the user.

## Allowed AI uses (whitelist)

1. Chart-type recommendation given a data shape (augmentation only).
2. Field-mapping hints.
3. Schema classification hints.
4. Short narrative insight bullets.

Anything else (layout, colors, anomaly detection, forecasting, aggregation
choice, NL-to-SQL, NL-to-dashboard) MUST be deterministic.

## How to use gstack here

Recurring sprint, in order:

| Stage  | Command                          |
| ------ | -------------------------------- |
| Think  | `/office-hours`                  |
| Plan   | `/autoplan`                      |
| Build  | (agent writes code)              |
| Review | `/review`                        |
| Test   | `/qa <staging-url>`              |
| Audit  | `/cso` (auth / payments / PII)   |
| Ship   | `/ship`                          |
| Deploy | `/land-and-deploy`               |
| Watch  | `/canary`                        |
| Learn  | `/retro` (weekly)                |

`/review` and `/cso` must check that any new AI call sites:

- Route through `src/ai/gateway.ts`.
- Have a deterministic fallback exercised by a passing test with
  `AI_ENABLED=false`.
- Are not on a hot path.

## Test discipline

- Every PR adds tests.
- All tests must pass with `AI_ENABLED=false` (the default in
  `vitest.config.ts`). This proves the product still ships with AI disabled.
- Regression tests live next to the code they cover under `test/`.

## Conventions

- TypeScript strict mode, no `any`.
- Zod for every external boundary (env, AI responses, webhook payloads).
- Pure functions for deterministic logic; side effects isolated to thin
  adapters.
- No mocks in production code. Test fakes are acceptable inside `test/` only.
