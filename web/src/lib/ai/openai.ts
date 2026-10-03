import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ExtractionSchema, type Extraction } from "./schema";
import { SYSTEM_PROMPT, userTurn } from "./prompt";

const DEFAULT_MODEL = "gpt-5.1";

let client: OpenAI | null = null;

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function extractWithOpenAI(
  message: string,
  context: { today: string; weekday: string },
): Promise<Extraction> {
  client ??= new OpenAI({ maxRetries: 1, timeout: 20_000 });

  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    instructions: SYSTEM_PROMPT,
    // Stable per deployment so the (long, static) system prompt can be cached.
    prompt_cache_key: "expense-gpt-extractor",
    reasoning: { effort: "low" },
    text: { format: zodTextFormat(ExtractionSchema, "extraction") },
    input: [{ role: "user", content: userTurn(message, context) }],
  });

  if (response.status !== "completed") {
    throw new Error(`extraction incomplete (status=${response.status}, reason=${response.incomplete_details?.reason})`);
  }
  const refusal = response.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .find((part) => part.type === "refusal");
  if (refusal) throw new Error("extraction refused");
  if (!response.output_parsed) throw new Error("extraction unparseable");
  return response.output_parsed;
}
