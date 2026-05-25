import { describe, expect, it } from "vitest";
import { intake } from "../src/ops/intake.js";
import { triage } from "../src/ops/triage.js";

const fixedNow = () => new Date("2026-05-25T10:00:00Z");

function makeTickets() {
  let n = 0;
  const id = () => `tkt_${++n}`;
  return [
    intake(
      {
        source: "email",
        subject: "Phishing",
        body: "spam from your domain",
      },
      fixedNow,
      id,
    ),
    intake(
      {
        source: "email",
        subject: "Refund",
        body: "Please refund my last invoice",
      },
      fixedNow,
      id,
    ),
    intake(
      {
        source: "form",
        subject: "Cannot login",
        body: "Login is broken",
      },
      fixedNow,
      id,
    ),
    intake(
      {
        source: "email",
        subject: "Feature request",
        body: "Please add dark mode",
      },
      fixedNow,
      id,
    ),
    intake(
      {
        source: "email",
        subject: "Hello",
        body: "Just saying hi",
      },
      fixedNow,
      id,
    ),
  ];
}

describe("deterministic triage", () => {
  it("orders by category priority: abuse > auth > billing > bug > feature > general", () => {
    const out = triage(makeTickets(), fixedNow);
    expect(out.map((t) => t.ticket.category)).toEqual([
      "abuse",
      "auth",
      "billing",
      "feature-request",
      "general",
    ]);
  });

  it("routes abuse, auth, billing, and bug to humans", () => {
    const out = triage(makeTickets(), fixedNow);
    const human = out.filter((t) => t.route === "needs-human").map((t) => t.ticket.category);
    expect(human).toEqual(expect.arrayContaining(["abuse", "auth", "billing"]));
  });

  it("auto-replies to feature requests and general", () => {
    const out = triage(makeTickets(), fixedNow);
    const auto = out.filter((t) => t.route === "auto-reply").map((t) => t.ticket.category);
    expect(auto).toEqual(expect.arrayContaining(["feature-request", "general"]));
  });

  it("attaches an SLA deadline strictly after now", () => {
    const out = triage(makeTickets(), fixedNow);
    for (const t of out) {
      expect(new Date(t.slaDeadline).getTime()).toBeGreaterThan(
        fixedNow().getTime(),
      );
    }
  });

  it("abuse SLA is the tightest", () => {
    const out = triage(makeTickets(), fixedNow);
    const abuse = out.find((t) => t.ticket.category === "abuse")!;
    const general = out.find((t) => t.ticket.category === "general")!;
    expect(new Date(abuse.slaDeadline).getTime()).toBeLessThan(
      new Date(general.slaDeadline).getTime(),
    );
  });
});
