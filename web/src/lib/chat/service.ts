import { extract as defaultExtract, type ExtractionSource, type Extractor } from "@/lib/ai/extract";
import type { Extraction, Period } from "@/lib/ai/schema";
import {
  categoryLabel,
  guessCategory,
  normaliseCategory,
  type TransactionType,
} from "@/lib/categories";
import {
  checkDateWindow,
  dateLabel,
  monthLabel,
  monthRange,
  resolveDate,
  todayIn,
} from "@/lib/dates";
import { formatMoney, MAX_AMOUNT, parseAmounts, toMinor } from "@/lib/money";
import type {
  ChatReply,
  ChatStore,
  DateRange,
  NewTransaction,
  SavedTransaction,
  TransactionView,
} from "./types";

const CLARIFICATION_WINDOW_MS = 15 * 60 * 1000;
const MAX_COMBINED_LENGTH = 400;
const MAX_DESCRIPTION_LENGTH = 200;

const EXAMPLES = "“Spent 500 on lunch” or “Received 50,000 salary”";

export interface ChatServiceDeps {
  store: ChatStore;
  extract?: Extractor;
  now?: () => Date;
}

export interface ChatRequest {
  userId: string;
  message: string;
  requestId?: string | null;
}

/** What the backend decided to do, before anything is persisted. */
interface Decision {
  intent: Extraction["intent"];
  transaction: NewTransaction | null;
  pendingText: string | null;
  reply: (saved: SavedTransaction | null) => Omit<ChatReply, "source">;
}

export function createChatService({ store, extract = defaultExtract, now = () => new Date() }: ChatServiceDeps) {
  return {
    async handle({ userId, message, requestId = null }: ChatRequest): Promise<ChatReply> {
      if (requestId) {
        const existing = await store.findReply(userId, requestId);
        if (existing) return existing;
      }

      const user = await store.getUser(userId);
      const current = now();
      const today = todayIn(user.timezone, current);
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: user.timezone, weekday: "long" }).format(current);
      const ctx = { today, weekday };

      let text = message.trim();
      let { extraction, source } = await extract(text, ctx);

      // A short answer to our last question ("4500", "income", "groceries")
      // only makes sense together with the message that prompted it.
      if (!isSelfContained(extraction)) {
        const pending = await store.pendingClarification(userId, new Date(current.getTime() - CLARIFICATION_WINDOW_MS));
        if (pending && pending.length + text.length < MAX_COMBINED_LENGTH) {
          text = `${pending}. ${text}`;
          ({ extraction, source } = await extract(text, ctx));
        }
      }

      const decision = await decide(store, user.id, user.currency, today, text, extraction, source);

      return store.saveExchange({
        userId,
        requestId,
        userMessage: message.trim(),
        intent: decision.intent,
        transaction: decision.transaction,
        pendingText: decision.pendingText,
        buildReply: (saved) => ({ ...decision.reply(saved), source }),
      });
    },
  };
}

function isSelfContained(e: Extraction): boolean {
  if (e.intent === "CLARIFY") return false;
  if (e.intent === "CREATE_EXPENSE" || e.intent === "CREATE_INCOME") return e.missing.length === 0;
  return e.intent !== "SMALLTALK";
}

function answered(intent: Extraction["intent"], message: string, status: ChatReply["status"] = "answered"): Decision {
  return { intent, transaction: null, pendingText: null, reply: () => ({ intent, status, message, transaction: null }) };
}

function ask(intent: Extraction["intent"], message: string, pendingText: string): Decision {
  return {
    intent: "CLARIFY",
    transaction: null,
    pendingText,
    reply: () => ({ intent, status: "needs_clarification", message, transaction: null }),
  };
}

async function decide(
  store: ChatStore,
  userId: string,
  currency: string,
  today: string,
  text: string,
  e: Extraction,
  source: ExtractionSource,
): Promise<Decision> {
  const money = (minor: number) => formatMoney(minor, currency);

  switch (e.intent) {
    case "CREATE_EXPENSE":
    case "CREATE_INCOME":
      return decideCreate(text, e, source, currency, today);

    case "CLARIFY": {
      if (e.missing.includes("type") && e.person && e.amount !== null) {
        const amount = money(toMinor(e.amount));
        return ask(
          e.intent,
          `Should I record ${amount} from ${e.person} as income? Reply “income”, or tell me if ${e.person} was paying you back.`,
          text,
        );
      }
      return ask(e.intent, e.clarification?.trim() || `Could you say that another way? For example: ${EXAMPLES}.`, text);
    }

    case "GET_BALANCE": {
      const t = await store.totals(userId, null);
      return answered(e.intent, `Your current balance is ${money(t.incomeMinor - t.expenseMinor)}.`);
    }

    case "GET_MONTHLY_TOTAL": {
      const { range, label } = periodRange(e.period, today);
      const rows = await store.expensesByCategory(userId, range);
      const total = rows.reduce((s, r) => s + r.totalMinor, 0);
      if (total === 0) return answered(e.intent, `You haven't recorded any expenses ${label} yet.`);
      const lines = rows.slice(0, 5).map((r) => `${categoryLabel("expense", r.category)} · ${money(r.totalMinor)}`);
      return answered(e.intent, `You've spent ${money(total)} ${label}.\n\n${lines.join("\n")}`);
    }

    case "GET_CATEGORY_TOTAL": {
      const category = normaliseCategory("expense", e.category);
      const name = categoryLabel("expense", category);
      const { range, label } = periodRange(e.period, today);
      const rows = await store.expensesByCategory(userId, range);
      const total = rows.find((r) => r.category === category)?.totalMinor ?? 0;
      return answered(
        e.intent,
        total === 0 ? `You haven't spent anything on ${name} ${label}.` : `You've spent ${money(total)} on ${name} ${label}.`,
      );
    }

    case "UNSUPPORTED":
      return answered(
        e.intent,
        "I can't do that yet. Right now I can record expenses and income, and tell you your balance and spending. Debt tracking, edits and reports are coming soon.",
        "unsupported",
      );

    case "SMALLTALK":
      return answered(e.intent, `Hi! Tell me what you spent or earned, like ${EXAMPLES}.`);
  }
}

function decideCreate(
  text: string,
  e: Extraction,
  source: ExtractionSource,
  currency: string,
  today: string,
): Decision {
  const type: TransactionType = e.intent === "CREATE_INCOME" ? "income" : "expense";
  const money = (minor: number) => formatMoney(minor, currency);
  let amount = e.amount;

  // The AI may only use an amount that is actually in the message.
  if (amount !== null && source === "ai" && !parseAmounts(text).includes(amount)) amount = null;

  const description = cleanDescription(e.description);

  if (amount === null || e.missing.includes("amount")) {
    const what = description && description.toLowerCase() !== "income" ? ` on ${description.toLowerCase()}` : "";
    return ask(
      e.intent,
      type === "income"
        ? `How much did you receive${description ? ` (${description})` : ""}?`
        : `How much did you spend${what}?`,
      text,
    );
  }

  if (amount <= 0 || amount > MAX_AMOUNT) {
    return ask(e.intent, `${money(toMinor(Math.abs(amount)))} doesn't look right. How much was it?`, text);
  }
  const amountMinor = toMinor(amount);

  if (!description || e.missing.includes("description")) {
    if (type === "expense") return ask(e.intent, `What did you spend the ${money(amountMinor)} on?`, text);
  }

  const date = resolveDate(e.date_expression, today);
  if (!date) return ask(e.intent, "Which date was that? You can say “yesterday” or “Oct 3”.", text);
  const window = checkDateWindow(date, today);
  if (window !== "ok") {
    return ask(
      e.intent,
      window === "too_far_ahead"
        ? "That date is in the future. When did it happen?"
        : "That's more than a year ago. Which date did you mean?",
      text,
    );
  }

  let category = normaliseCategory(type, e.category);
  if (category === "other") category = guessCategory(type, `${description ?? ""} ${text}`) ?? "other";

  const transaction: NewTransaction = {
    type,
    amountMinor,
    currency,
    category,
    description: description ?? categoryLabel(type, category),
    merchant: e.merchant?.trim() || null,
    person: e.person?.trim() || null,
    transactionDate: date,
  };

  return {
    intent: e.intent,
    transaction,
    pendingText: null,
    reply: (saved) => {
      const view = toView(saved!, today);
      const details = [view.categoryLabel];
      if (view.description.toLowerCase() !== view.categoryLabel.toLowerCase()) details.push(view.description);
      details.push(view.dateLabel);
      return {
        intent: e.intent,
        status: "saved",
        message: `✓ Added ${money(amountMinor)} ${type}\n${details.join(" · ")}`,
        transaction: view,
      };
    },
  };
}

function cleanDescription(raw: string | null): string | null {
  const d = raw?.replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_LENGTH);
  if (!d) return null;
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function periodRange(period: Period | null, today: string): { range: DateRange | null; label: string } {
  if (period === "all_time") return { range: null, label: "in total" };
  if (period === "last_month") {
    const range = monthRange(today, -1);
    return { range, label: `in ${monthLabel(range.from).split(" ")[0]}` };
  }
  return { range: monthRange(today), label: "this month" };
}

export function toView(t: SavedTransaction, today: string): TransactionView {
  return {
    id: t.id,
    type: t.type,
    amountMinor: t.amountMinor,
    currency: t.currency,
    category: t.category,
    categoryLabel: categoryLabel(t.type, t.category),
    description: t.description,
    date: t.transactionDate,
    dateLabel: dateLabel(t.transactionDate, today),
  };
}
