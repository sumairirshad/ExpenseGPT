import { claudeConfigured, extractWithClaude } from "./claude";
import { openaiConfigured, extractWithOpenAI } from "./openai";
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

type ProviderName = "claude" | "openai";

interface Provider {
  configured: () => boolean;
  extract: (message: string, context: ExtractContext) => Promise<Extraction>;
}

const PROVIDERS: Record<ProviderName, Provider> = {
  claude: { configured: claudeConfigured, extract: extractWithClaude },
  openai: { configured: openaiConfigured, extract: extractWithOpenAI },
};

/** Which provider to try first. Defaults to Claude; set AI_PROVIDER=openai to prefer OpenAI instead. */
function providerOrder(): ProviderName[] {
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase() === "openai" ? "openai" : "claude";
  const other: ProviderName = preferred === "claude" ? "openai" : "claude";
  return [preferred, other];
}

/** The preferred configured AI provider, falling back to the other one, then to the deterministic parser. */
export const extract: Extractor = async (message, context) => {
  for (const name of providerOrder()) {
    const provider = PROVIDERS[name];
    if (!provider.configured()) continue;
    try {
      return { extraction: await provider.extract(message, context), source: "ai" };
    } catch (err) {
      // Never log the message itself: it's financial data.
      console.error(`${name} extraction failed, falling back:`, err instanceof Error ? err.message : err);
    }
  }
  return { extraction: extractWithRules(message), source: "rules" };
};
