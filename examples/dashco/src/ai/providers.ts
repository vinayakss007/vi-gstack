/**
 * AI provider adapters. Real implementations only — no mocks.
 *
 * Two providers ship:
 *
 *   - `deterministic`: returns `null`. The gateway treats this as "no AI
 *     opinion" and the deterministic fallback returns. This is the path the
 *     product runs on by default and the path tests exercise. It is NOT a
 *     mock — it is the production behavior when AI is disabled.
 *
 *   - `openai`: real network call to OpenAI's chat-completions endpoint with
 *     `response_format: json_object`. Requires `OPENAI_API_KEY`.
 *
 * Adding a new provider means adding a branch here and an enum value in
 * `src/env.ts`. Nothing else in the product changes.
 */

export interface ProviderInput {
  provider: "deterministic" | "openai";
  model: string;
  system: string;
  user: string;
  apiKey?: string | undefined;
}

export async function runProvider(input: ProviderInput): Promise<unknown> {
  switch (input.provider) {
    case "deterministic":
      return null;
    case "openai":
      return runOpenAI(input);
  }
}

async function runOpenAI(input: ProviderInput): Promise<unknown> {
  if (!input.apiKey) {
    throw new Error("OPENAI_API_KEY missing");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`openai http ${res.status}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("openai empty content");
  }
  return JSON.parse(content);
}
