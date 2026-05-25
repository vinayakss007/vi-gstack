/**
 * Single AI gateway. Every AI call in the product goes through here.
 *
 * Guarantees enforced by this file:
 *
 *   1. AI is OFF by default. With `AI_ENABLED=false`, this gateway returns the
 *      caller-supplied `fallback` value immediately and never touches network.
 *   2. Provider responses are validated against a Zod schema. Schema-violating
 *      responses are treated as a provider failure, the fallback returns, and
 *      the failure is logged.
 *   3. All failures are silent to the caller. No throw escapes this function.
 *   4. The caller always has a deterministic fallback. The signature requires
 *      one — there is no overload that lets you call AI without one.
 *
 * This shape is what the AI usage policy demands: the product fully ships with
 * AI disabled, and AI can only augment, never replace, a deterministic result.
 */

import { z, type ZodTypeAny } from "zod";
import { env } from "../env.js";
import { runProvider } from "./providers.js";

export interface GatewayCall<T> {
  /** Stable name for telemetry, e.g. `chart.recommend`. */
  task: string;
  /**
   * The deterministic result that already-shipped without AI. Returned
   * unchanged whenever AI is disabled, fails, or returns a schema-invalid
   * response.
   */
  fallback: T;
  /** Zod schema used to validate the provider response. */
  schema: ZodTypeAny;
  /** System prompt — the instruction. */
  system: string;
  /** User prompt — the data shape, never the raw data. */
  user: string;
  /**
   * Reconciles the AI's raw parsed response with the deterministic fallback.
   * Implementations enforce the "deterministic always wins on disagreement"
   * rule for their domain (e.g. chart type can't change, only `reason` can).
   */
  reconcile: (aiResult: unknown, fallback: T) => T;
}

export interface GatewayResult<T> {
  value: T;
  source: "ai" | "fallback";
  /** Set when AI was attempted but ignored. */
  reason?:
    | "ai-disabled"
    | "no-provider-key"
    | "schema-invalid"
    | "provider-error"
    | "reconcile-rejected";
}

export async function callGateway<T>(call: GatewayCall<T>): Promise<GatewayResult<T>> {
  if (!env.AI_ENABLED) {
    return { value: call.fallback, source: "fallback", reason: "ai-disabled" };
  }
  if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
    log("no-provider-key", call.task);
    return { value: call.fallback, source: "fallback", reason: "no-provider-key" };
  }

  let raw: unknown;
  try {
    raw = await runProvider({
      provider: env.AI_PROVIDER,
      model: env.OPENAI_MODEL,
      system: call.system,
      user: call.user,
      apiKey: env.OPENAI_API_KEY,
    });
  } catch (err) {
    log("provider-error", call.task, err);
    return { value: call.fallback, source: "fallback", reason: "provider-error" };
  }

  const parsed = call.schema.safeParse(raw);
  if (!parsed.success) {
    log("schema-invalid", call.task, parsed.error.issues);
    return { value: call.fallback, source: "fallback", reason: "schema-invalid" };
  }

  let reconciled: T;
  try {
    reconciled = call.reconcile(parsed.data, call.fallback);
  } catch (err) {
    log("reconcile-rejected", call.task, err);
    return { value: call.fallback, source: "fallback", reason: "reconcile-rejected" };
  }

  return { value: reconciled, source: "ai" };
}

/**
 * Telemetry hook. Replace with your logger of choice. Stays narrow on purpose
 * so it never surfaces to the caller.
 */
function log(kind: string, task: string, detail?: unknown): void {
  const payload = { kind, task, detail };
  // eslint-disable-next-line no-console
  console.warn(`[ai-gateway] ${JSON.stringify(payload)}`);
}

export { z };
