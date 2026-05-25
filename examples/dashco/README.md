# dashco — automatic company starter on gstack

A minimal, runnable scaffold demonstrating how to use [gstack](../../) to operate
a one-person SaaS where engineering is gstack-driven and operations are
deterministic.

> **In production, this lives in its own repo** (e.g. `acme-co/`). It sits inside
> `vi-gstack/examples/` only so it can be reviewed on GitHub alongside the
> framework. To use it, copy the `dashco/` directory out, `git init`, and go.

## What this demonstrates

The four-layer model from the planning discussion:

| Layer            | Owned by                            | In this scaffold                          |
| ---------------- | ----------------------------------- | ----------------------------------------- |
| Strategy         | You + gstack `/office-hours`        | `policies/AI_USAGE.md`                    |
| Ops / GTM        | Deterministic code                  | `src/ops/{intake,triage,digest}.ts`       |
| Engineering      | gstack skills                       | `CLAUDE.md` wires `/review`, `/ship`…     |
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
bun test            # 35 real tests pass with AI_ENABLED=false
bun run typecheck
bun run day-one     # boots PGLite + Hono, posts 4 tickets, prints the digest
make day-one        # the same plus tests + typecheck

# Long-running HTTP server on :3000
bun run server
```

To exercise the AI path with a real provider, set `AI_ENABLED=true` plus
`AI_PROVIDER=openai` and `OPENAI_API_KEY`. Without those, the gateway returns
the deterministic fallback and the product still ships.

## HTTP surface

```
GET  /health
POST /api/intake               body: IntakePayload
GET  /api/digest?windowHours=N
POST /api/charts/recommend     body: DataShape
```

Try it after `bun run server`:

```bash
curl -s -X POST http://localhost:3000/api/intake \
  -H 'content-type: application/json' \
  -d '{"source":"email","subject":"Refund","body":"Please refund my last charge"}'

curl -s 'http://localhost:3000/api/digest?windowHours=24' | jq
```

## Stack

- **Runtime**: Bun (Node-compatible — swap `Bun.serve` in `bin/server.ts` for
  `@hono/node-server` if you must run on Node).
- **HTTP**: [Hono](https://hono.dev) — runs anywhere.
- **DB**: [PGLite](https://github.com/electric-sql/pglite) — real Postgres
  (WASM). No external service. To use real Postgres in production, swap the
  driver in `src/db/client.ts` and pass a `DATABASE_URL`. Schema and queries
  do not change. PGLite is not a mock; it is real Postgres.
- **ORM**: [Drizzle](https://orm.drizzle.team) — TS-native.
- **Validation**: [Zod](https://zod.dev) at every external boundary.
- **Tests**: [Vitest](https://vitest.dev). HTTP integration tests use Hono's
  `app.fetch(new Request(...))` — real Request/Response cycle, no mocks.

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
├── README.md                       ← you are here
├── CLAUDE.md                       ← agent guidance, references policies/
├── Makefile                        ← `make day-one`
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── policies/
│   └── AI_USAGE.md                 ← the rule, written down
├── bin/
│   ├── day-one.ts                  ← end-to-end proof script
│   └── server.ts                   ← long-running HTTP server
├── src/
│   ├── env.ts                      ← Zod-validated env
│   ├── ai/
│   │   ├── gateway.ts              ← single AI entry point + fallback
│   │   └── providers.ts            ← deterministic + openai providers
│   ├── charts/
│   │   ├── shape.ts                ← data-shape primitives
│   │   ├── recommend.ts            ← DETERMINISTIC algorithm (primary)
│   │   └── recommend-ai.ts         ← AI augmentation (deterministic wins)
│   ├── ops/
│   │   ├── intake.ts               ← deterministic ticket classification
│   │   ├── triage.ts               ← deterministic SLA-based prioritization
│   │   └── digest.ts               ← deterministic daily summary
│   ├── db/
│   │   ├── schema.ts               ← Drizzle schema
│   │   ├── client.ts               ← PGLite + drizzle factory + migrations
│   │   └── repository.ts           ← row <-> Ticket mapper
│   ├── server/
│   │   ├── app.ts                  ← Hono app factory
│   │   └── routes/
│   │       ├── health.ts
│   │       ├── intake.ts
│   │       ├── digest.ts
│   │       └── recommend.ts
│   └── demo.ts                     ← `bun run demo` (logic-only walkthrough)
└── test/
    ├── recommend.test.ts
    ├── gateway.test.ts
    ├── intake.test.ts
    ├── triage.test.ts
    ├── digest.test.ts
    └── server.test.ts              ← real HTTP + real PGLite, no mocks
```

## Day-one output (truncated)

```
== POST /api/intake (4 sample payloads) ==
  201  billing           Refund for last invoice
  201  auth              Cannot login
  201  feature-request   Feature request: dark mode
  201  abuse             Phishing emails from your domain

== GET /api/digest?windowHours=24 ==
{
  "totals": { "received": 4, "autoReplied": 1, "needsHuman": 3, "overdue": 0 },
  "byCategory": { "abuse": 1, "auth": 1, "billing": 1, "feature-request": 1, ...},
  "topPriority": [
    { "category": "abuse",   "slaDeadline": "2026-05-25T19:00:00.000Z" },
    { "category": "auth",    "slaDeadline": "2026-05-25T22:00:00.000Z" },
    { "category": "billing", "slaDeadline": "2026-05-26T02:00:00.000Z" },
    { "category": "feature-request", "slaDeadline": "2026-05-28T18:00:00.000Z" }
  ]
}

[dashco] day-one OK. Every layer wired through real PGLite + Hono. AI disabled by default.
```
