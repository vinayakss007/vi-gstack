# dashco — automatic company starter on gstack

A minimal, runnable scaffold demonstrating how to use [gstack](../../) to operate
a one-person SaaS where engineering is gstack-driven and operations are
deterministic.

> **In production, this lives in its own repo** (e.g. `acme-co/`). It sits inside
> `vi-gstack/examples/` only so it can be reviewed on GitHub alongside the
> framework. To use it, copy the `dashco/` directory out, `git init`, and go.

## What this demonstrates

The four-layer model from the planning discussion:

| Layer            | Owned by                            | In this scaffold                       |
| ---------------- | ----------------------------------- | -------------------------------------- |
| Strategy         | You + gstack `/office-hours`        | `policies/AI_USAGE.md`                 |
| Ops / GTM        | Deterministic code                  | `src/ops/{intake,triage,digest}.ts`    |
| Engineering      | gstack skills                       | `CLAUDE.md` wires `/review`, `/ship`…  |
| Governance       | Written policy + CI gates           | `policies/AI_USAGE.md` + `vitest.config.ts` |

## The non-negotiable rule

**AI is not load-bearing.** The deterministic path must fully ship without any
AI provider configured. AI is only allowed to *augment* a deterministic
result, never replace it. See `policies/AI_USAGE.md`.

The chart recommender (`src/charts/recommend.ts`) is a real deterministic
algorithm. The AI wrapper (`src/charts/recommend-ai.ts`) calls the gateway and
**throws away the AI result if it disagrees with the deterministic pick** —
deterministic always wins. AI provides reasoning text, not the decision.

## Run it

```bash
bun install
bun test            # all real tests pass with AI disabled
bun run demo        # show chart recommendations for a few data shapes
```

To see the AI wrapper in action with a real provider, set `AI_ENABLED=true` and
plug in `AI_PROVIDER=openai` + `OPENAI_API_KEY`. Without those, the gateway
returns the deterministic fallback and the product still ships.

## How gstack drives this repo

`CLAUDE.md` tells gstack-aware agents (Claude Code, Kiro, Codex CLI, Cursor…)
how to work in this repo. The recurring sprint:

```
/office-hours      → reframe before coding
/autoplan          → CEO + eng + design + DX review
/review            → catches bugs, auto-fixes obvious
/qa <staging-url>  → real browser, finds + fixes more bugs
/cso               → required for anything touching auth/payments/PII
/ship              → tests + PR
/land-and-deploy   → merge + deploy + verify
/canary            → 30 min post-deploy watch
/retro             → weekly
```

`policies/AI_USAGE.md` is referenced from `CLAUDE.md` so every gstack review
enforces the no-load-bearing-AI rule.

## File map

```
dashco/
├── README.md              ← you are here
├── CLAUDE.md              ← agent guidance, references policies/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .gitignore
├── policies/
│   └── AI_USAGE.md        ← the rule, written down
├── src/
│   ├── env.ts             ← Zod-validated env, AI off by default
│   ├── ai/
│   │   ├── gateway.ts     ← single AI entry point, schema + fallback
│   │   └── providers.ts   ← deterministic + openai providers
│   ├── charts/
│   │   ├── shape.ts       ← data-shape primitives
│   │   ├── recommend.ts   ← DETERMINISTIC algorithm (primary)
│   │   └── recommend-ai.ts← AI-augmented wrapper (deterministic always wins)
│   ├── ops/
│   │   ├── intake.ts      ← deterministic ticket classification
│   │   ├── triage.ts      ← deterministic SLA-based prioritization
│   │   └── digest.ts      ← deterministic daily summary
│   └── demo.ts            ← `bun run demo` entry
└── test/
    ├── recommend.test.ts
    ├── gateway.test.ts
    ├── intake.test.ts
    ├── triage.test.ts
    └── digest.test.ts
```
