import type { ChatReply, ChatStore, DateRange, SavedTransaction, UserContext } from "@/lib/chat/types";

interface StoredMessage {
  role: "user" | "assistant";
  intent: string;
  requestId: string | null;
  reply?: ChatReply;
  pendingText?: string | null;
  createdAt: Date;
}

/** In-memory ChatStore for service tests. Mirrors the Drizzle store's semantics. */
export function createMemoryStore(user: UserContext, clock: () => Date) {
  const transactions: (SavedTransaction & { deleted: boolean })[] = [];
  const messages: StoredMessage[] = [];
  let nextId = 1;

  const inRange = (date: string, range: DateRange | null) => !range || (date >= range.from && date < range.to);
  const live = () => transactions.filter((t) => !t.deleted);

  const store: ChatStore = {
    async getUser(userId) {
      if (userId !== user.id) throw new Error("user not found");
      return user;
    },
    async findReply(_userId, requestId) {
      const i = messages.findIndex((m) => m.role === "user" && m.requestId === requestId);
      return i >= 0 ? messages[i + 1]?.reply ?? null : null;
    },
    async pendingClarification(_userId, since) {
      const last = [...messages].reverse().find((m) => m.role === "assistant");
      if (!last || last.intent !== "CLARIFY" || last.createdAt < since) return null;
      return last.pendingText ?? null;
    },
    async totals(_userId, range) {
      const rows = live().filter((t) => inRange(t.transactionDate, range));
      const sum = (type: string) => rows.filter((t) => t.type === type).reduce((s, t) => s + t.amountMinor, 0);
      return { incomeMinor: sum("income"), expenseMinor: sum("expense") };
    },
    async expensesByCategory(_userId, range) {
      const totals = new Map<string, number>();
      for (const t of live()) {
        if (t.type !== "expense" || !inRange(t.transactionDate, range)) continue;
        totals.set(t.category, (totals.get(t.category) ?? 0) + t.amountMinor);
      }
      return [...totals].map(([category, totalMinor]) => ({ category, totalMinor })).sort((a, b) => b.totalMinor - a.totalMinor);
    },
    async saveExchange({ requestId, intent, transaction, pendingText, buildReply }) {
      if (requestId) {
        const existing = await store.findReply(user.id, requestId);
        if (existing) return existing;
      }
      let saved: SavedTransaction | null = null;
      if (transaction) {
        saved = { ...transaction, id: `tx-${nextId++}` };
        transactions.push({ ...saved, deleted: false });
      }
      const reply = buildReply(saved);
      messages.push({ role: "user", intent, requestId, createdAt: clock() });
      messages.push({ role: "assistant", intent, requestId: null, reply, pendingText, createdAt: clock() });
      return reply;
    },
  };

  return { store, transactions, messages };
}
