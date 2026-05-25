import { describe, expect, it } from "vitest";
import { intake } from "../src/ops/intake.js";

const fixedNow = () => new Date("2026-05-25T10:00:00Z");
let n = 0;
const fixedId = () => `tkt_${++n}`;

describe("deterministic intake classifier", () => {
  it("classifies refund/invoice as billing", () => {
    const t = intake(
      {
        source: "email",
        subject: "Refund for September invoice",
        body: "I would like a refund.",
        email: "a@example.com",
      },
      fixedNow,
      fixedId,
    );
    expect(t.category).toBe("billing");
    expect(t.classifierRule).toBe("billing-keywords");
  });

  it("classifies stripe webhooks as billing regardless of body", () => {
    const t = intake(
      {
        source: "stripe",
        subject: "invoice.paid",
        body: "{}",
      },
      fixedNow,
      fixedId,
    );
    expect(t.category).toBe("billing");
    expect(t.classifierRule).toBe("source-stripe");
  });

  it("classifies login problems as auth", () => {
    const t = intake(
      {
        source: "form",
        subject: "Cannot sign in",
        body: "Password reset is broken",
        email: "x@example.com",
      },
      fixedNow,
      fixedId,
    );
    // Both auth and bug match. Auth rule fires first because it is more
    // specific to user impact.
    expect(t.category).toBe("auth");
  });

  it("classifies error/crash text as a bug", () => {
    const t = intake(
      {
        source: "email",
        subject: "App crashed",
        body: "I got a 500 error and stack trace on /reports.",
      },
      fixedNow,
      fixedId,
    );
    expect(t.category).toBe("bug");
  });

  it("classifies abuse keywords ahead of everything else", () => {
    const t = intake(
      {
        source: "form",
        subject: "Phishing emails from your domain",
        body: "Your invoices look like spam.",
      },
      fixedNow,
      fixedId,
    );
    expect(t.category).toBe("abuse");
  });

  it("falls back to general when no rule fires", () => {
    const t = intake(
      {
        source: "email",
        subject: "Hello",
        body: "Just saying hi.",
      },
      fixedNow,
      fixedId,
    );
    expect(t.category).toBe("general");
    expect(t.classifierRule).toBe("fallback-general");
  });

  it("rejects payloads missing required fields", () => {
    expect(() =>
      // @ts-expect-error testing runtime validation
      intake({ source: "email", body: "x" }, fixedNow, fixedId),
    ).toThrow();
  });
});
