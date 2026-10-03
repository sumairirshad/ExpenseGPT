import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatInput } from "../components/ChatInput";
import { TransactionItem } from "../components/TransactionItem";
import { deleteTransaction, fetchDashboard, restoreTransaction, sendChatMessage } from "../lib/api";
import { formatMoney } from "../lib/money";
import { useTheme } from "../lib/theme";
import type { ChatReply, Dashboard } from "../lib/types";

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

export default function DashboardScreen() {
  const theme = useTheme();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await fetchDashboard());
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
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
    const id = Crypto.randomUUID(); // doubles as the idempotency key
    setDraft("");
    setExchanges((list) => [...list, { id, text, reply: null, error: null, repliedAt: null, undone: false }].slice(-VISIBLE_EXCHANGES));
    try {
      const reply = await sendChatMessage(text, id);
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
    const ok = exchange.undone ? await restoreTransaction(tx.id) : await deleteTransaction(tx.id);
    if (ok) {
      const at = clock();
      update(exchange.id, { undone: !exchange.undone, repliedAt: at });
      setNow(at);
      void refresh();
    }
  }

  const currency = data?.currency ?? "PKR";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.subtleText} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Expense GPT</Text>
              <Text style={{ fontSize: 12, color: theme.subtleText }}>Your finances, just chat.</Text>
            </View>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.cardBorder,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>D</Text>
            </View>
          </View>

          <View style={{ borderRadius: 16, padding: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.cardBorder }}>
            <Text style={{ fontSize: 13, color: theme.subtleText }}>{data?.month ?? " "}</Text>
            <Text style={{ fontSize: 13, color: theme.subtleText, marginTop: 12 }}>Balance</Text>
            <Text style={{ fontSize: 30, fontWeight: "600", color: theme.text, fontVariant: ["tabular-nums"] }}>
              {data ? formatMoney(data.balanceMinor, currency) : "—"}
            </Text>
            <View style={{ flexDirection: "row", marginTop: 16, gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: theme.subtleText }}>Income</Text>
                <Text style={{ fontSize: 15, fontWeight: "500", color: theme.income, fontVariant: ["tabular-nums"] }}>
                  {data ? formatMoney(data.monthIncomeMinor, currency) : "—"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: theme.subtleText }}>Expenses</Text>
                <Text style={{ fontSize: 15, fontWeight: "500", color: theme.expense, fontVariant: ["tabular-nums"] }}>
                  {data ? formatMoney(data.monthExpenseMinor, currency) : "—"}
                </Text>
              </View>
            </View>
            {loadError && (
              <Text style={{ marginTop: 12, fontSize: 13, color: theme.errorText }}>
                Couldn&apos;t load your summary. Is the web server reachable?
              </Text>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: theme.subtleText }}>What would you like to record?</Text>

            {exchanges.length > 0 && (
              <View style={{ gap: 10 }}>
                {exchanges.map((e) => (
                  <View key={e.id} style={{ gap: 6 }}>
                    <Text
                      style={{
                        alignSelf: "flex-end",
                        maxWidth: "85%",
                        backgroundColor: theme.bubbleUserBg,
                        color: theme.bubbleUserText,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 16,
                        borderBottomRightRadius: 4,
                        fontSize: 14,
                        overflow: "hidden",
                      }}
                    >
                      {e.text}
                    </Text>
                    {e.reply || e.error ? (
                      <View
                        style={{
                          alignSelf: "flex-start",
                          maxWidth: "90%",
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 16,
                          borderBottomLeftRadius: 4,
                          borderWidth: 1,
                          backgroundColor: e.error ? theme.errorBg : theme.bubbleAssistantBg,
                          borderColor: e.error ? theme.errorBorder : theme.bubbleAssistantBorder,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: e.error ? theme.errorText : theme.text }}>
                          {e.error ?? (e.undone ? "Removed." : e.reply!.message)}
                        </Text>
                        {e.reply?.status === "saved" && e.repliedAt && now - e.repliedAt < UNDO_WINDOW_MS && (
                          <Pressable onPress={() => toggleUndo(e)} style={{ marginTop: 6, alignSelf: "flex-start" }}>
                            <Text style={{ fontSize: 12, fontWeight: "500", color: theme.accent }}>
                              {e.undone ? "Restore" : "Undo"}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ) : (
                      <Text style={{ paddingHorizontal: 4, fontSize: 14, color: theme.mutedText }}>•••</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <ChatInput ref={inputRef} value={draft} onChange={setDraft} onSend={send} />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    setDraft(s);
                    inputRef.current?.focus();
                  }}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: theme.chipBg,
                    borderWidth: 1,
                    borderColor: theme.chipBorder,
                  }}
                >
                  <Text style={{ fontSize: 12, color: theme.chipText }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ borderRadius: 16, padding: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.cardBorder }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: theme.subtleText }}>Recent transactions</Text>
            {data && data.recent.length === 0 ? (
              <Text style={{ marginTop: 12, fontSize: 14, color: theme.subtleText }}>
                Tell me about your first expense or income.
              </Text>
            ) : (
              <View style={{ marginTop: 4 }}>
                {data?.recent.map((t) => <TransactionItem key={t.id} transaction={t} />)}
              </View>
            )}
          </View>

          <Text style={{ textAlign: "center", fontSize: 13, color: theme.mutedText }}>Monthly report · coming soon</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
