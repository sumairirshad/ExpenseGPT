import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { transactions } from "@/db/schema";

export const TransactionIdSchema = z.uuid();

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
