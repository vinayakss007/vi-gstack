import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { App } from "../src/server/app.js";
import { createApp } from "../src/server/app.js";
import { createDb, type DbHandle } from "../src/db/client.js";

const fixedNow = () => new Date("2026-05-25T10:00:00Z");

describe("HTTP server (Hono + PGLite, no mocks)", () => {
  let handle: DbHandle;
  let app: App;

  beforeEach(async () => {
    handle = await createDb();
    app = createApp({ db: handle.db, now: fixedNow });
  });

  afterEach(async () => {
    await handle.close();
  });

  it("GET /health returns ok", async () => {
    const res = await app.fetch(new Request("http://local/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("POST /api/intake validates, classifies, persists, returns 201", async () => {
    const res = await app.fetch(
      new Request("http://local/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "email",
          subject: "Refund for September invoice",
          body: "Please refund my last charge",
          email: "a@example.com",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const t = (await res.json()) as { id: string; category: string };
    expect(t.category).toBe("billing");
    expect(t.id).toBeTruthy();
  });

  it("POST /api/intake rejects invalid payload with 400", async () => {
    const res = await app.fetch(
      new Request("http://local/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "email" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_payload");
  });

  it("POST /api/intake rejects malformed JSON with 400", async () => {
    const res = await app.fetch(
      new Request("http://local/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/digest aggregates persisted tickets deterministically", async () => {
    // Persist three tickets through the real intake route.
    const payloads = [
      { source: "email", subject: "Refund", body: "refund please" },
      { source: "form", subject: "Phishing", body: "spam from your domain" },
      { source: "email", subject: "Hello", body: "Just saying hi" },
    ];
    for (const p of payloads) {
      const res = await app.fetch(
        new Request("http://local/api/intake", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(p),
        }),
      );
      expect(res.status).toBe(201);
    }

    const res = await app.fetch(
      new Request("http://local/api/digest?windowHours=24"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totals: { received: number; needsHuman: number; autoReplied: number };
      byCategory: Record<string, number>;
      topPriority: { category: string }[];
    };
    expect(body.totals.received).toBe(3);
    expect(body.byCategory["abuse"]).toBe(1);
    expect(body.byCategory["billing"]).toBe(1);
    expect(body.byCategory["general"]).toBe(1);
    expect(body.topPriority[0]?.category).toBe("abuse");
    expect(body.topPriority[1]?.category).toBe("billing");
  });

  it("POST /api/charts/recommend returns served and deterministic picks", async () => {
    const res = await app.fetch(
      new Request("http://local/api/charts/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          columns: [
            { name: "ts", kind: "temporal" },
            { name: "value", kind: "numeric" },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      served: { chart: string };
      source: string;
      deterministic: { chart: string };
    };
    expect(body.deterministic.chart).toBe("line");
    expect(body.served.chart).toBe("line");
    // AI disabled by default in tests, so the served result comes from
    // fallback and matches the deterministic pick exactly.
    expect(body.source).toBe("fallback");
  });

  it("POST /api/charts/recommend rejects invalid shape with 400", async () => {
    const res = await app.fetch(
      new Request("http://local/api/charts/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ columns: [] }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
