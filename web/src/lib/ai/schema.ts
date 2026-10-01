import { z } from "zod";

// The contract between the extractor (LLM or rules) and the backend.
// The extractor only *interprets* the message. It never sees balances and
// never produces numbers or text that we show the user verbatim, except an
// optional clarifying question for cases our templates don't cover.

export const INTENTS = [
  "CREATE_EXPENSE",
  "CREATE_INCOME",
  "GET_BALANCE",
  "GET_MONTHLY_TOTAL",
  "GET_CATEGORY_TOTAL",
  "CLARIFY",
  "UNSUPPORTED",
  "SMALLTALK",
] as const;

export const IntentSchema = z.enum(INTENTS);
export type Intent = z.infer<typeof IntentSchema>;

export const PeriodSchema = z.enum(["current_month", "last_month", "all_time"]);
export type Period = z.infer<typeof PeriodSchema>;

export const MissingFieldSchema = z.enum(["amount", "description", "type"]);
export type MissingField = z.infer<typeof MissingFieldSchema>;

export const ExtractionSchema = z.object({
  intent: IntentSchema,
  /** Major units as written by the user ("5k" → 5000). */
  amount: z.number().nullable(),
  /** Category slug; validated against our list by the backend. */
  category: z.string().nullable(),
  description: z.string().nullable(),
  merchant: z.string().nullable(),
  person: z.string().nullable(),
  /** The date phrase from the message ("yesterday", "oct 3") or YYYY-MM-DD. */
  date_expression: z.string().nullable(),
  period: PeriodSchema.nullable(),
  /**
   * Fields a CREATE_* intent still needs; the backend asks for them. "type"
   * (income or not?) is only used with CLARIFY, e.g. "Ali paid me 5000".
   */
  missing: z.array(MissingFieldSchema),
  /** Free-text clarifying question, only for cases templates don't cover. */
  clarification: z.string().nullable(),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export function emptyExtraction(intent: Intent, patch: Partial<Extraction> = {}): Extraction {
  return {
    intent,
    amount: null,
    category: null,
    description: null,
    merchant: null,
    person: null,
    date_expression: null,
    period: null,
    missing: [],
    clarification: null,
    ...patch,
  };
}
