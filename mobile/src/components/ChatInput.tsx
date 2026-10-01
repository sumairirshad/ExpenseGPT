import { forwardRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../lib/theme";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
}

export const ChatInput = forwardRef<TextInput, Props>(function ChatInput({ value, onChange, onSend }, ref) {
  const theme = useTheme();
  const canSend = value.trim().length > 0;

  const submit = () => {
    const text = value.trim();
    if (text) onSend(text);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={submit}
        multiline
        maxLength={500}
        placeholder="I spent 850 on dinner…"
        placeholderTextColor={theme.mutedText}
        style={[styles.input, { color: theme.text }]}
        accessibilityLabel="Message"
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        accessibilityLabel="Send"
        style={[styles.sendButton, { backgroundColor: theme.bubbleUserBg, opacity: canSend ? 1 : 0.3 }]}
      >
        <Text style={[styles.sendIcon, { color: theme.bubbleUserText }]}>➤</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 128,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: { fontSize: 16 },
});
