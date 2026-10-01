import type { Intent } from "@/lib/ai/schema";
import type { ExtractionSource } from "@/lib/ai/extract";
import type { TransactionType } from "@/lib/categories";

export interface UserContext {
  id: string;
  currency: string;
  timezone: string;
}

export interface NewTransaction {
  type: TransactionType;
  amountMinor: number;
  currency: string;
  category: string;
  description: string;
  merchant: string | null;
  person: string | null;
  transactionDate: string;
}

export interface SavedTransaction extends NewTransaction {
  id: string;
}

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

export type ReplyStatus = "saved" | "needs_clarification" | "answered" | "unsupported";

export interface ChatReply {
  intent: Intent;
  status: ReplyStatus;
  message: string;
  transaction: TransactionView | null;
  source: ExtractionSource;
}

export interface Totals {
  incomeMinor: number;
  expenseMinor: number;
}

export interface DateRange {
  from: string; // inclusive
  to: string; // exclusive
}

export interface ChatStore {
  getUser(userId: string): Promise<UserContext>;
  /** Reply previously stored for this idempotency key, if any. */
  findReply(userId: string, requestId: string): Promise<ChatReply | null>;
  /** Text still awaiting a clarification answer, if the last reply asked a question recently. */
  pendingClarification(userId: string, since: Date): Promise<string | null>;
  totals(userId: string, range: DateRange | null): Promise<Totals>;
  expensesByCategory(userId: string, range: DateRange | null): Promise<{ category: string; totalMinor: number }[]>;
  /**
   * Persist the user message, the optional transaction and the assistant
   * reply atomically. `buildReply` receives the saved transaction (with id).
   * If `requestId` was already used, returns the stored reply instead.
   */
  saveExchange(input: {
    userId: string;
    requestId: string | null;
    userMessage: string;
    intent: Intent;
    transaction: NewTransaction | null;
    /** Set when the reply asks a question; the text the answer should be combined with. */
    pendingText: string | null;
    buildReply: (saved: SavedTransaction | null) => ChatReply;
  }): Promise<ChatReply>;
}
