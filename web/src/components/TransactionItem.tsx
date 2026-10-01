import type { TransactionView } from "@/lib/chat/types";
import { formatSigned } from "@/lib/money";

export function TransactionItem({ transaction: t }: { transaction: TransactionView }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{t.description}</p>
        <p className="truncate text-xs text-zinc-500">
          {t.categoryLabel} · {t.dateLabel}
        </p>
      </div>
      <p
        className={`shrink-0 text-sm font-medium tabular-nums ${
          t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {formatSigned(t.amountMinor, t.type)}
      </p>
    </li>
  );
}
