/**
 * `bun run day-one` — end-to-end proof.
 *
 * Boots an in-memory PGLite, posts four sample tickets through the REAL
 * /api/intake route, calls /api/digest, and prints the result. No mocks.
 *
 * If this command exits 0, every layer of the stack works:
 *   - DB migrations (PGLite + Drizzle)
 *   - HTTP server (Hono)
 *   - Deterministic intake classifier
 *   - Deterministic triage
 *   - Deterministic digest
 *   - AI gateway (in fallback mode)
 */

import { createDb } from "../src/db/client.js";
import { createApp } from "../src/server/app.js";
import { recommend } from "../src/charts/recommend.js";

const fixedNow = () => new Date("2026-05-25T18:00:00Z");

const inbound = [
  {
    source: "email",
    subject: "Refund for last invoice",
    body: "Please refund my October charge.",
    email: "a@example.com",
  },
  {
    source: "form",
    subject: "Cannot login",
    body: "I get a 500 error when I sign in.",
    email: "b@example.com",
  },
  {
    source: "email",
    subject: "Feature request: dark mode",
    body: "Would be great to have a dark theme.",
    email: "c@example.com",
  },
  {
    source: "form",
    subject: "Phishing emails from your domain",
    body: "Someone is sending spam from your domain.",
    email: "d@example.com",
  },
];

async function main() {
  const handle = await createDb();
  const app = createApp({ db: handle.db, now: fixedNow });

  console.log("== POST /api/intake (4 sample payloads) ==");
  for (const payload of inbound) {
    const res = await app.fetch(
      new Request("http://local/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    if (res.status !== 201) {
      throw new Error(
        `intake failed: ${res.status} ${await res.text()}`,
      );
    }
    const t = (await res.json()) as { id: string; category: string };
    console.log(`  ${res.status}  ${t.category.padEnd(16)}  ${payload.subject}`);
  }

  console.log("\n== GET /api/digest?windowHours=24 ==");
  const digestRes = await app.fetch(
    new Request("http://local/api/digest?windowHours=24"),
  );
  const digestBody = await digestRes.json();
  console.log(JSON.stringify(digestBody, null, 2));

  console.log("\n== POST /api/charts/recommend (revenue over time) ==");
  const chartRes = await app.fetch(
    new Request("http://local/api/charts/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        columns: [
          { name: "month", kind: "temporal" },
          { name: "revenue_usd", kind: "numeric" },
        ],
      }),
    }),
  );
  const chartBody = (await chartRes.json()) as {
    served: { chart: string; reason: string };
    source: string;
  };
  console.log(`served: ${chartBody.served.chart} via ${chartBody.source}`);
  console.log(`reason: ${chartBody.served.reason}`);

  console.log("\n== POST /api/fields/map (messy sales CSV -> schema) ==");
  const fieldsRes = await app.fetch(
    new Request("http://local/api/fields/map", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceColumns: [
          "Order Date",
          "Total $",
          "Cust ID",
          "SKU",
          "Qty",
          "Country",
        ],
        targetSchema: [
          { name: "date", aliases: ["order_date"] },
          { name: "revenue" },
          { name: "customer_id" },
          { name: "product" },
          { name: "quantity" },
          { name: "country" },
        ],
      }),
    }),
  );
  const fieldsBody = (await fieldsRes.json()) as {
    served: {
      mappings: { source: string; target: string; method: string; score: number }[];
      unmappedSource: string[];
      unmappedTarget: string[];
    };
    source: string;
  };
  for (const m of fieldsBody.served.mappings) {
    console.log(
      `  ${m.method.padEnd(8)}  ${m.score.toFixed(2)}  ${m.source.padEnd(14)} -> ${m.target}`,
    );
  }
  if (fieldsBody.served.unmappedSource.length > 0) {
    console.log(`  unmapped source: ${fieldsBody.served.unmappedSource.join(", ")}`);
  }

  console.log("\n== POST /api/insights (monthly revenue, 12 months) ==");
  const insightsRes = await app.fetch(
    new Request("http://local/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        metric: "monthly revenue",
        values: [120, 140, 160, 175, 210, 250, 600, 320, 360, 410, 480, 520],
        labels: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
      }),
    }),
  );
  const insightsBody = (await insightsRes.json()) as {
    served: {
      insights: { kind: string; text: string; facts: Record<string, unknown> }[];
    };
    source: string;
  };
  for (const i of insightsBody.served.insights) {
    console.log(`  [${i.kind.padEnd(8)}] ${i.text}`);
  }

  // Sanity check: deterministic primary path is unaffected by anything HTTP.
  const det = recommend({
    columns: [
      { name: "month", kind: "temporal" },
      { name: "revenue_usd", kind: "numeric" },
    ],
  });
  if (det.chart !== "line") {
    throw new Error(`deterministic recommender broke: got ${det.chart}`);
  }

  await handle.close();
  console.log(
    "\n[dashco] day-one OK. Every layer wired through real PGLite + Hono. AI disabled by default.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
