import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Theme } from "../theme";
import { ENV } from "../lib/env";
import { useAppState } from "../state/AppState";

const rows = [
  { label: "Overview", path: "/dashboard" },
  { label: "Events", path: "/events" },
  { label: "Generate Image", path: "/generate/image" },
  { label: "Generate Text", path: "/generate/text" },
  { label: "Generate Video", path: "/generate/video" },
  { label: "Feeds", path: "/feeds" },
  { label: "Accounts", path: "/accounts" },
  { label: "Wallets", path: "/wallets" },
  { label: "Clanker Launcher", path: "/clanker" },
  { label: "Support", path: "https://support.ba6-bsky-suite.com" }
];

export function Settings({ navigation }: any) {
  const { identity, email, signOut } = useAppState();
  const base = useMemo(() => {
    const raw = ENV.DASHBOARD_URL || ENV.BA6_API_BASE || "";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  }, []);

  async function open(path: string) {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    if (!url) return;
    await WebBrowser.openBrowserAsync(url);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Theme.colors.surface }}>
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: Theme.spacing.lg,
          paddingBottom: Theme.spacing.md,
          backgroundColor: Theme.colors.primaryBlue
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>Settings</Text>
          <Pressable onPress={() => navigation.goBack?.()}>
            <Text style={{ color: "white", fontWeight: "700" }}>Close</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Theme.spacing.lg }}>
        <View
          style={{
            borderWidth: 1,
            borderColor: Theme.colors.border,
            backgroundColor: "white",
            padding: Theme.spacing.md,
            borderRadius: Theme.radius.lg
          }}
        >
          <Text style={{ fontWeight: "800", color: Theme.colors.text }}>Profile</Text>
          <Text style={{ marginTop: 6, color: Theme.colors.textMuted }}>
            {identity?.handle ? `@${identity.handle}` : identity?.did ?? "Signed in"}
          </Text>
          {email ? (
            <Text style={{ marginTop: 2, color: Theme.colors.textMuted }}>{email}</Text>
          ) : null}
          <Pressable
            onPress={signOut}
            style={{
              marginTop: Theme.spacing.sm,
              height: 40,
              borderRadius: Theme.radius.md,
              borderWidth: 1,
              borderColor: Theme.colors.border,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ fontWeight: "700", color: Theme.colors.text }}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={{ marginTop: Theme.spacing.lg, marginBottom: Theme.spacing.sm, color: Theme.colors.textMuted }}>
          Tools & modules
        </Text>

        {rows.map((row) => (
          <Pressable
            key={row.label}
            onPress={() => open(row.path)}
            style={{
              borderWidth: 1,
              borderColor: Theme.colors.border,
              backgroundColor: "white",
              padding: Theme.spacing.md,
              borderRadius: Theme.radius.lg,
              marginBottom: Theme.spacing.sm
            }}
          >
            <Text style={{ fontWeight: "800", color: Theme.colors.text }}>{row.label}</Text>
            <Text style={{ marginTop: 4, color: Theme.colors.textMuted }}>
              Open in secure view
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
