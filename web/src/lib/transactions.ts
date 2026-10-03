import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { categories, transactions, users } from "@/db/schema";
import type { TransactionView } from "@/lib/chat/types";
import { dateLabel, todayIn } from "@/lib/dates";
import { MAX_AMOUNT, toMinor } from "@/lib/money";

export const TransactionIdSchema = z.uuid();

export const CreateTransactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  categoryId: z.uuid(),
  amount: z.number().positive().finite().max(MAX_AMOUNT),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

export type CreateTransactionResult =
  | { ok: true; transaction: TransactionView }
  | { ok: false; error: "category_not_found" };

/** A manual Debit/Credit entry from the finance UI (source: "manual", no chat message). */
export async function createManualTransaction(
  db: Db,
  userId: string,
  input: CreateTransactionInput,
): Promise<CreateTransactionResult> {
  const [category] = await db
    .select({ slug: categories.slug, label: categories.label })
    .from(categories)
    .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)));
  if (!category) return { ok: false, error: "category_not_found" };

  const [user] = await db
    .select({ timezone: users.timezone, currency: users.defaultCurrency })
    .from(users)
    .where(eq(users.id, userId));
  const today = todayIn(user.timezone);
  const amountMinor = toMinor(input.amount);

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      type: input.type,
      amountMinor,
      currency: user.currency,
      category: category.slug,
      description: category.label,
      transactionDate: today,
      source: "manual",
    })
    .returning();

  return {
    ok: true,
    transaction: {
      id: row.id,
      type: input.type,
      amountMinor,
      currency: user.currency,
      category: category.slug,
      categoryLabel: category.label,
      description: row.description,
      date: today,
      dateLabel: dateLabel(today, today),
    },
  };
}

/** Soft delete. Always scoped by user; returns false if nothing matched. */
export async function softDeleteTransaction(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(transactions)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .returning({ id: transactions.id });
  return rows.length > 0;
}

export async function restoreTransaction(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(transactions)
    .set({ deletedAt: null, updatedAt: sql`now()` })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId), isNotNull(transactions.deletedAt)))
    .returning({ id: transactions.id });
  return rows.length > 0;
}
