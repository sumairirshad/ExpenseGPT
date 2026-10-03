import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractionSchema, type Extraction } from "./schema";
import { SYSTEM_PROMPT, userTurn } from "./prompt";

const DEFAULT_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractWithClaude(
  message: string,
  context: { today: string; weekday: string },
): Promise<Extraction> {
  client ??= new Anthropic({ maxRetries: 1, timeout: 20_000 });

  const response = await client.beta.messages.parse({
    model: process.env.EXPENSEGPT_MODEL || DEFAULT_MODEL,
    max_tokens: 4096,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: zodOutputFormat(ExtractionSchema) },
    messages: [{ role: "user", content: userTurn(message, context) }],
  });

  if (response.stop_reason === "refusal") throw new Error("extraction refused");
  if (!response.parsed_output) throw new Error(`extraction unparseable (stop_reason=${response.stop_reason})`);
  return response.parsed_output;
}
