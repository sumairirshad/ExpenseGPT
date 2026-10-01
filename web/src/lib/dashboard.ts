import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db";
import { transactions } from "@/db/schema";
import { createDrizzleStore } from "@/lib/chat/drizzle-store";
import { toView } from "@/lib/chat/service";
import type { TransactionView } from "@/lib/chat/types";
import { monthLabel, monthRange, todayIn } from "@/lib/dates";

export const RECENT_LIMIT = 8;

export interface Dashboard {
  month: string;
  currency: string;
  balanceMinor: number;
  monthIncomeMinor: number;
  monthExpenseMinor: number;
  recent: TransactionView[];
}

export async function getDashboard(db: Db, userId: string, now = new Date()): Promise<Dashboard> {
  const store = createDrizzleStore(db);
  const user = await store.getUser(userId);
  const today = todayIn(user.timezone, now);

  const [allTime, month, recent] = await Promise.all([
    store.totals(userId, null),
    store.totals(userId, monthRange(today)),
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
      .limit(RECENT_LIMIT),
  ]);

  return {
    month: monthLabel(today),
    currency: user.currency,
    balanceMinor: allTime.incomeMinor - allTime.expenseMinor,
    monthIncomeMinor: month.incomeMinor,
    monthExpenseMinor: month.expenseMinor,
    recent: recent.map((t) => toView(t, today)),
  };
}
