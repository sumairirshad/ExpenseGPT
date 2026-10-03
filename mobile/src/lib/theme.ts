import { useColorScheme } from "react-native";

// Mirrors the zinc/emerald/rose palette used by the web app's Tailwind classes.
const light = {
  background: "#f4f4f5", // zinc-100
  card: "#ffffff",
  cardBorder: "#e4e4e7", // zinc-200
  text: "#18181b", // zinc-900
  subtleText: "#71717a", // zinc-500
  mutedText: "#a1a1aa", // zinc-400
  bubbleUserBg: "#18181b", // zinc-900
  bubbleUserText: "#ffffff",
  bubbleAssistantBg: "#ffffff",
  bubbleAssistantBorder: "#e4e4e7",
  errorBg: "#fff1f2", // rose-50
  errorBorder: "#fecdd3", // rose-200
  errorText: "#be123c", // rose-700
  income: "#059669", // emerald-600
  expense: "#e11d48", // rose-600
  accent: "#0284c7", // sky-600
  chipBg: "#ffffff",
  chipBorder: "#e4e4e7",
  chipText: "#52525b", // zinc-600
};

const dark: typeof light = {
  background: "#09090b", // zinc-950
  card: "#18181b", // zinc-900
  cardBorder: "#27272a", // zinc-800
  text: "#f4f4f5", // zinc-100
  subtleText: "#a1a1aa", // zinc-400 (web uses zinc-500 but bumped for contrast on dark)
  mutedText: "#71717a",
  bubbleUserBg: "#f4f4f5", // zinc-100
  bubbleUserText: "#18181b",
  bubbleAssistantBg: "#18181b",
  bubbleAssistantBorder: "#27272a",
  errorBg: "#4c0519", // rose-950
  errorBorder: "#881337",
  errorText: "#fda4af", // rose-300
  income: "#34d399", // emerald-400
  expense: "#fb7185", // rose-400
  accent: "#38bdf8", // sky-400
  chipBg: "#18181b",
  chipBorder: "#27272a",
  chipText: "#d4d4d8", // zinc-300
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
