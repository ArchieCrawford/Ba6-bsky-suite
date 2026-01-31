import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { ENV } from "../lib/env";

type LinkItem = {
  label: string;
  subtitle: string;
  path?: string;
  action?: () => Promise<void>;
};

export function ConsoleHome({ navigation }: { navigation: any }) {
  const base = useMemo(() => {
    const raw = ENV.DASHBOARD_URL || ENV.BA6_API_BASE || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);

  const openPath = async (path: string) => {
    if (!base) return;
    await WebBrowser.openBrowserAsync(`${base}${path}`);
  };

  const items: LinkItem[] = [
    { label: "Overview", subtitle: "Ops snapshot + KPIs", path: "/dashboard" },
    { label: "Events", subtitle: "Audit trail + system events", path: "/events" },
    { label: "Generate Image", subtitle: "Venice image generator", path: "/generate/image" },
    { label: "Generate Text", subtitle: "Venice text generator", path: "/generate/text" },
    { label: "Generate Video", subtitle: "Venice video generator", path: "/generate/video" },
    { label: "Feeds", subtitle: "Feed configs, rules, publish", path: "/feeds" },
    { label: "Accounts", subtitle: "Bluesky accounts + status", path: "/accounts" },
    { label: "Wallets", subtitle: "Connect and verify wallets", path: "/wallets" }
  ];

  return (
    <View style={{ flex: 1, paddingTop: 54, backgroundColor: "white" }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: "900" }}>BA6 Console</Text>
        <Text style={{ marginTop: 6, opacity: 0.65 }}>
          Same BA6 dashboard modules, optimized for mobile navigation.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            onPress={async () => {
              if (item.action) return item.action();
              if (item.path) return openPath(item.path);
            }}
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              padding: 14,
              borderRadius: 16,
              marginBottom: 12,
              backgroundColor: "white"
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900" }}>{item.label}</Text>
            <Text style={{ marginTop: 6, opacity: 0.7 }}>{item.subtitle}</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => navigation.navigate("ClankerLauncher")}
          style={{
            borderWidth: 1,
            borderColor: "rgba(155,135,245,0.45)",
            padding: 14,
            borderRadius: 16,
            marginBottom: 12,
            backgroundColor: "rgba(155,135,245,0.08)"
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "900" }}>Clanker Launcher</Text>
          <Text style={{ marginTop: 6, opacity: 0.7 }}>
            Token launch + dashboard tools.
          </Text>
        </Pressable>

        {!base ? (
          <Text style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
            Set EXPO_PUBLIC_DASHBOARD_URL to enable dashboard modules.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
