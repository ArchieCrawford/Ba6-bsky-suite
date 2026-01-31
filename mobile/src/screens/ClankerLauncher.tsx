import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { ENV } from "../lib/env";

export function ClankerLauncher() {
  const url = useMemo(() => {
    const raw = ENV.DASHBOARD_URL || ENV.BA6_API_BASE || "";
    const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
    return base ? `${base}/clanker` : "";
  }, []);

  async function open() {
    if (!url) return;
    await WebBrowser.openBrowserAsync(url);
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 8 }}>
        Clanker Token Launcher
      </Text>
      <Text style={{ opacity: 0.7, marginBottom: 16 }}>
        This opens the BA6 dashboard launcher module in an in-app browser.
      </Text>
      <Pressable
        onPress={open}
        disabled={!url}
        style={{
          backgroundColor: url ? "rgba(155,135,245,0.25)" : "rgba(0,0,0,0.08)",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: url ? "rgba(155,135,245,0.45)" : "rgba(0,0,0,0.12)",
        }}
      >
        <Text style={{ fontWeight: "700", textAlign: "center" }}>
          Open Launcher
        </Text>
      </Pressable>

      {!url ? (
        <Text style={{ marginTop: 14, fontSize: 12, opacity: 0.6 }}>
          Set EXPO_PUBLIC_DASHBOARD_URL (or EXPO_PUBLIC_BA6_API_BASE) to enable this.
        </Text>
      ) : null}
    </View>
  );
}
