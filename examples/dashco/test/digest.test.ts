import { describe, expect, it } from "vitest";
import { digest } from "../src/ops/digest.js";
import { intake } from "../src/ops/intake.js";
import { triage } from "../src/ops/triage.js";

describe("deterministic daily digest", () => {
  it("counts only tickets within the window", () => {
    let n = 0;
    const id = () => `tkt_${++n}`;
    const old = intake(
      { source: "email", subject: "old refund", body: "refund please" },
      () => new Date("2026-05-20T10:00:00Z"),
      id,
    );
    const recent = intake(
      { source: "email", subject: "new refund", body: "refund please" },
      () => new Date("2026-05-25T08:00:00Z"),
      id,
    );
    const tickets = [old, recent];
    const triaged = triage(tickets, () => new Date("2026-05-25T09:00:00Z"));

    const d = digest(
      { tickets, triaged, windowHours: 24 },
      () => new Date("2026-05-25T18:00:00Z"),
    );

    expect(d.totals.received).toBe(1);
    expect(d.byCategory.billing).toBe(1);
  });

  it("counts overdue tickets", () => {
    let n = 0;
    const id = () => `tkt_${++n}`;
    // Bug has 24h SLA; received 25h before "now" -> overdue.
    const t = intake(
      { source: "email", subject: "broken", body: "500 error stack trace" },
      () => new Date("2026-05-24T16:00:00Z"),
      id,
    );
    const tickets = [t];
    const triaged = triage(tickets, () => new Date("2026-05-24T16:00:00Z"));
    const d = digest(
      { tickets, triaged, windowHours: 48 },
      () => new Date("2026-05-25T18:00:00Z"),
    );
    expect(d.totals.overdue).toBe(1);
  });

  it("produces deterministic top-priority list", () => {
    let n = 0;
    const id = () => `tkt_${++n}`;
    const now = () => new Date("2026-05-25T08:00:00Z");
    const tickets = [
      intake(
        { source: "email", subject: "Refund", body: "refund please" },
        now,
        id,
      ),
      intake(
        { source: "form", subject: "Phishing", body: "spam from your domain" },
        now,
        id,
      ),
      intake(
        { source: "email", subject: "Hello", body: "Just saying hi" },
        now,
        id,
      ),
    ];
    const triaged = triage(tickets, now);
    const d = digest(
      { tickets, triaged, windowHours: 24 },
      () => new Date("2026-05-25T18:00:00Z"),
    );
    expect(d.topPriority[0]?.category).toBe("abuse");
    expect(d.topPriority[1]?.category).toBe("billing");
  });
});
