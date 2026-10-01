import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { useTheme } from "../lib/theme";

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </>
  );
}
