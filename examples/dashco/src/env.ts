import { z } from "zod";

/**
 * Zod-validated environment.
 *
 * Defaults are chosen so the product fully ships with AI disabled. Anyone can
 * clone this repo, `bun install`, `bun test`, and everything passes without
 * configuring a provider.
 */
const Env = z.object({
  AI_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  AI_PROVIDER: z.enum(["deterministic", "openai"]).default("deterministic"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
});

export type Env = z.infer<typeof Env>;

export const env: Env = Env.parse(process.env);
