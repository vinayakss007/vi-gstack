/**
 * `bun run demo` — show the full loop end-to-end on synthetic but realistic
 * data. Runs entirely on the deterministic path (AI disabled by default).
 */

import { recommend } from "./charts/recommend.js";
import { recommendWithAI } from "./charts/recommend-ai.js";
import type { DataShape } from "./charts/shape.js";
import { intake } from "./ops/intake.js";
import { triage } from "./ops/triage.js";
import { digest } from "./ops/digest.js";
import { env } from "./env.js";

const shapes: { label: string; shape: DataShape }[] = [
  {
    label: "monthly revenue",
    shape: {
      columns: [
        { name: "month", kind: "temporal" },
        { name: "revenue_usd", kind: "numeric" },
      ],
    },
  },
  {
    label: "revenue by product line over time",
    shape: {
      columns: [
        { name: "month", kind: "temporal" },
        { name: "revenue_usd", kind: "numeric" },
        { name: "product_line", kind: "categorical", distinctCount: 4 },
      ],
    },
  },
  {
    label: "headcount by department",
    shape: {
      columns: [
        { name: "department", kind: "categorical", distinctCount: 8 },
        { name: "headcount", kind: "numeric" },
      ],
    },
  },
  {
    label: "click-through vs conversion",
    shape: {
      columns: [
        { name: "ctr", kind: "numeric" },
        { name: "conversion_rate", kind: "numeric" },
      ],
    },
  },
];

async function main() {
  console.log(`AI_ENABLED=${env.AI_ENABLED}  provider=${env.AI_PROVIDER}\n`);

  console.log("== chart recommendations ==");
  for (const { label, shape } of shapes) {
    const det = recommend(shape);
    const aug = await recommendWithAI(shape);
    console.log(
      `- ${label}\n    deterministic: ${det.chart} (${det.rule})\n    served: ${aug.value.chart} via ${aug.source}${aug.reason ? ` [${aug.reason}]` : ""}\n    reason: ${aug.value.reason}`,
    );
  }

  console.log("\n== ops loop (intake -> triage -> digest) ==");
  const now = () => new Date("2026-05-25T10:00:00Z");
  const inbound = [
    {
      source: "email" as const,
      subject: "Refund for last invoice",
      body: "Please refund my October charge.",
      email: "a@example.com",
    },
    {
      source: "form" as const,
      subject: "Cannot login",
      body: "I get a 500 error when I try to sign in.",
      email: "b@example.com",
    },
    {
      source: "email" as const,
      subject: "Feature request: dark mode",
      body: "Would be great to have a dark theme.",
      email: "c@example.com",
    },
    {
      source: "form" as const,
      subject: "I think you have a phishing problem",
      body: "Someone is sending spam from your domain.",
      email: "d@example.com",
    },
  ];

  let counter = 0;
  const tickets = inbound.map((p) =>
    intake(p, now, () => `tkt_${++counter}`),
  );
  const triaged = triage(tickets, now);
  const d = digest(
    { tickets, triaged, windowHours: 24 },
    () => new Date("2026-05-25T18:00:00Z"),
  );

  for (const t of triaged) {
    console.log(
      `- [${t.priority}] ${t.ticket.category.padEnd(16)} -> ${t.route.padEnd(12)} sla=${t.slaDeadline} :: ${t.ticket.subject}`,
    );
  }

  console.log("\n== digest ==");
  console.log(JSON.stringify(d, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
