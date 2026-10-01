// Mirrors the API shapes in web/src/lib/chat/types.ts and web/src/lib/dashboard.ts.
// The mobile app is a second client of the same Next.js API — it never talks
// to Postgres or the AI provider directly.

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

export type Intent = (typeof INTENTS)[number];

export type TransactionType = "expense" | "income";

export type ReplyStatus = "saved" | "needs_clarification" | "answered" | "unsupported";

export interface TransactionView {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  category: string;
  categoryLabel: string;
  description: string;
  date: string;
  dateLabel: string;
}

export interface ChatReply {
  intent: Intent;
  status: ReplyStatus;
  message: string;
  transaction: TransactionView | null;
  source: "ai" | "rules";
}

export interface Dashboard {
  month: string;
  currency: string;
  balanceMinor: number;
  monthIncomeMinor: number;
  monthExpenseMinor: number;
  recent: TransactionView[];
}
