import { claudeConfigured, extractWithClaude } from "./claude";
import { extractWithRules } from "./rules";
import type { Extraction } from "./schema";

export type ExtractionSource = "ai" | "rules";

export interface ExtractContext {
  today: string;
  weekday: string;
}

export type Extractor = (
  message: string,
  context: ExtractContext,
) => Promise<{ extraction: Extraction; source: ExtractionSource }>;

/** Claude when configured; the deterministic parser otherwise or on failure. */
export const extract: Extractor = async (message, context) => {
  if (claudeConfigured()) {
    try {
      return { extraction: await extractWithClaude(message, context), source: "ai" };
    } catch (err) {
      // Never log the message itself: it's financial data.
      console.error("AI extraction failed, using rules:", err instanceof Error ? err.message : err);
    }
  }
  return { extraction: extractWithRules(message), source: "rules" };
};
