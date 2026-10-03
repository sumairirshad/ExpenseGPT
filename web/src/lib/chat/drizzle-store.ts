import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db";
import { chatMessages, transactions, users } from "@/db/schema";
import type { ChatReply, ChatStore, DateRange, SavedTransaction } from "./types";

interface AssistantPayload {
  reply: ChatReply;
  pendingText: string | null;
}

export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function rangeFilter(range: DateRange | null) {
  return range
    ? and(gte(transactions.transactionDate, range.from), lt(transactions.transactionDate, range.to))
    : undefined;
}

export function createDrizzleStore(db: Db): ChatStore {
  const store: ChatStore = {
    async getUser(userId) {
      const [u] = await db
        .select({ id: users.id, currency: users.defaultCurrency, timezone: users.timezone })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)));
      if (!u) throw new Error("user not found");
      return u;
    },

    async findReply(userId, requestId) {
      const question = alias(chatMessages, "question");
      const [row] = await db
        .select({ payload: chatMessages.payload })
        .from(chatMessages)
        .innerJoin(question, eq(question.id, chatMessages.replyTo))
        .where(
          and(
            eq(question.userId, userId),
            eq(question.requestId, requestId),
            eq(chatMessages.role, "assistant"),
          ),
        );
      return row ? (row.payload as AssistantPayload).reply : null;
    },

    async pendingClarification(userId, since) {
      const [last] = await db
        .select({ intent: chatMessages.intent, payload: chatMessages.payload, createdAt: chatMessages.createdAt })
        .from(chatMessages)
        .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "assistant")))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);
      if (!last || last.intent !== "CLARIFY" || last.createdAt < since) return null;
      return (last.payload as AssistantPayload).pendingText;
    },

    async totals(userId, range) {
      const [row] = await db
        .select({
          income: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'income'), 0)`,
          expense: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'expense'), 0)`,
        })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt), rangeFilter(range)));
      return { incomeMinor: Number(row.income), expenseMinor: Number(row.expense) };
    },

    async expensesByCategory(userId, range) {
      const total = sql<string>`sum(${transactions.amountMinor})`;
      const rows = await db
        .select({ category: transactions.category, total })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, "expense"),
            isNull(transactions.deletedAt),
            rangeFilter(range),
          ),
        )
        .groupBy(transactions.category)
        .orderBy(desc(total));
      return rows.map((r) => ({ category: r.category, totalMinor: Number(r.total) }));
    },

    async saveExchange({ userId, requestId, userMessage, intent, transaction, pendingText, buildReply }) {
      try {
        return await db.transaction(async (tx) => {
          const [userRow] = await tx
            .insert(chatMessages)
            .values({ userId, role: "user", message: userMessage, intent, requestId })
            .returning({ id: chatMessages.id });

          let saved: SavedTransaction | null = null;
          if (transaction) {
            const [t] = await tx
              .insert(transactions)
              .values({ ...transaction, userId, source: "chat", chatMessageId: userRow.id })
              .returning({ id: transactions.id });
            saved = { ...transaction, id: t.id };
          }

          const reply = buildReply(saved);
          const payload: AssistantPayload = { reply, pendingText };
          await tx.insert(chatMessages).values({
            userId,
            role: "assistant",
            message: reply.message,
            intent,
            replyTo: userRow.id,
            payload,
          });
          return reply;
        });
      } catch (err) {
        // Same requestId raced in concurrently: return whatever the winner stored.
        if (requestId && isUniqueViolation(err)) {
          const existing = await store.findReply(userId, requestId);
          if (existing) return existing;
        }
        throw err;
      }
    },
  };
  return store;
}
