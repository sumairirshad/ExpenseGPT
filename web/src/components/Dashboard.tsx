"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatReply } from "@/lib/chat/types";
import type { Dashboard as DashboardData } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { ChatInput } from "./ChatInput";
import { TransactionItem } from "./TransactionItem";

const SUGGESTIONS = ["Spent 500 on lunch", "Received 50,000 salary", "How much did I spend this month?"];
const UNDO_WINDOW_MS = 30_000;
const VISIBLE_EXCHANGES = 3;

// Event-time clock, kept outside the component so it's never read during render.
const clock = () => Date.now();

interface Exchange {
  id: string;
  text: string;
  reply: ChatReply | null;
  error: string | null;
  repliedAt: number | null;
  undone: boolean;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // Initial load from the API; setState happens after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Tick while an Undo button is visible so it disappears after the window.
  const undoOpen = exchanges.some((e) => e.reply?.status === "saved" && !e.undone && e.repliedAt && now - e.repliedAt < UNDO_WINDOW_MS);
  useEffect(() => {
    if (!undoOpen) return;
    const t = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(t);
  }, [undoOpen]);

  const update = (id: string, patch: Partial<Exchange>) =>
    setExchanges((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  async function send(text: string) {
    const id = crypto.randomUUID(); // doubles as the idempotency key
    setDraft("");
    setExchanges((list) => [...list, { id, text, reply: null, error: null, repliedAt: null, undone: false }].slice(-VISIBLE_EXCHANGES));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, requestId: id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const reply: ChatReply = await res.json();
      const repliedAt = clock();
      setNow(repliedAt);
      update(id, { reply, repliedAt });
      if (reply.status === "saved") void refresh();
    } catch {
      update(id, { error: "Couldn't reach Expense GPT. Please try again." });
    }
    inputRef.current?.focus();
  }

  async function toggleUndo(exchange: Exchange) {
    const tx = exchange.reply?.transaction;
    if (!tx) return;
    const res = await fetch(`/api/transactions/${tx.id}${exchange.undone ? "/restore" : ""}`, {
      method: exchange.undone ? "POST" : "DELETE",
    });
    if (res.ok) {
      const at = clock();
      update(exchange.id, { undone: !exchange.undone, repliedAt: at });
      setNow(at);
      void refresh();
    }
  }

  const currency = data?.currency ?? "PKR";

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 sm:max-w-lg sm:gap-5 md:max-w-xl lg:max-w-2xl
        pt-[max(1rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))]
        pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]
        sm:pt-[max(2rem,env(safe-area-inset-top))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]
        sm:pb-[max(2rem,env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))]"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Expense GPT</h1>
          <p className="truncate text-xs text-zinc-500">Your finances, just chat.</p>
        </div>
        <div
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium dark:bg-zinc-800"
        >
          D
        </div>
      </header>

      <section
        aria-label="Summary"
        className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-5 dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <p className="text-sm text-zinc-500">{data?.month ?? " "}</p>
        <p className="mt-3 text-sm text-zinc-500">Balance</p>
        <p className="text-2xl font-semibold tabular-nums break-words sm:text-3xl" data-testid="balance">
          {data ? formatMoney(data.balanceMinor, currency) : "—"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">Income</p>
            <p className="truncate font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
              {data ? formatMoney(data.monthIncomeMinor, currency) : "—"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">Expenses</p>
            <p className="truncate font-medium tabular-nums text-rose-600 dark:text-rose-400">
              {data ? formatMoney(data.monthExpenseMinor, currency) : "—"}
            </p>
          </div>
        </div>
        {loadError && (
          <p className="mt-3 text-sm text-rose-600" role="alert">
            Couldn&apos;t load your summary. Is the database running?
          </p>
        )}
      </section>

      <section aria-label="Record" className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">What would you like to record?</h2>

        {exchanges.length > 0 && (
          <ol className="flex flex-col gap-2" aria-live="polite">
            {exchanges.map((e) => (
              <li key={e.id} className="flex flex-col gap-1.5">
                <p className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-zinc-900 px-3.5 py-2 text-sm break-words text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {e.text}
                </p>
                {e.reply || e.error ? (
                  <div
                    className={`max-w-[85%] self-start rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm whitespace-pre-line break-words ring-1 ${
                      e.error
                        ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900"
                        : "bg-white ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
                    }`}
                    data-testid="reply"
                  >
                    {e.error ?? (e.undone ? "Removed." : e.reply!.message)}
                    {e.reply?.status === "saved" && e.repliedAt && now - e.repliedAt < UNDO_WINDOW_MS && (
                      <button
                        type="button"
                        onClick={() => toggleUndo(e)}
                        className="ml-3 text-xs font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                      >
                        {e.undone ? "Restore" : "Undo"}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="self-start px-1 text-sm text-zinc-400" aria-label="Thinking">
                    <span className="animate-pulse">•••</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}

        <ChatInput ref={inputRef} value={draft} onChange={setDraft} onSend={send} />

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setDraft(s);
                inputRef.current?.focus();
              }}
              className="rounded-full bg-white px-3 py-1.5 text-xs text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section
        aria-label="Recent transactions"
        className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-5 dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Recent transactions</h2>
        {data && data.recent.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Tell me about your first expense or income.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
            {data?.recent.map((t) => <TransactionItem key={t.id} transaction={t} />)}
          </ul>
        )}
      </section>

      <p className="text-center text-sm text-zinc-400">Monthly report · coming soon</p>
    </main>
  );
}
