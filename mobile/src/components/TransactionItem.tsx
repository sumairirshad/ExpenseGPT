import { StyleSheet, Text, View } from "react-native";
import { formatSigned } from "../lib/money";
import { useTheme } from "../lib/theme";
import type { TransactionView } from "../lib/types";

export function TransactionItem({ transaction: t }: { transaction: TransactionView }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderColor: theme.cardBorder }]}>
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.description, { color: theme.text }]}>
          {t.description}
        </Text>
        <Text style={[styles.meta, { color: theme.subtleText }]}>
          {t.categoryLabel} · {t.dateLabel}
        </Text>
      </View>
      <Text style={[styles.amount, { color: t.type === "income" ? theme.income : theme.text }]}>
        {formatSigned(t.amountMinor, t.type)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, minWidth: 0 },
  description: { fontSize: 14, fontWeight: "500" },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "500", fontVariant: ["tabular-nums"] },
});
