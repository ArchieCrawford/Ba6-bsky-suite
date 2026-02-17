import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAppState } from "../state/AppState";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { ScreenHeader } from "../ui/towns/ScreenHeader";
import { SurfaceCard } from "../ui/towns/SurfaceCard";
import { consoleTools, buildConsoleUrl } from "../lib/consoleTools";

export function Settings({ navigation }: any) {
  const { email, signOut } = useAppState();

  async function open(path: string) {
    const url = buildConsoleUrl(path);
    if (!url) return;
    await WebBrowser.openBrowserAsync(url);
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <ScreenHeader title="Tools & settings" subtitle="Console access and account details." onPressBack={() => navigation.goBack?.()} backLabel="Close" />

      <ScrollView contentContainerStyle={{ padding: T.space.s16 }}>
        <SurfaceCard>
          <Text style={{ fontWeight: "800", color: T.colors.text }}>Profile</Text>
          <Text style={{ marginTop: 6, color: T.colors.textMuted }}>
            {email ?? "Signed in"}
          </Text>
          <Pressable
            onPress={signOut}
            style={{
              marginTop: T.space.s10,
              height: 40,
              borderRadius: T.radii.pill,
              backgroundColor: T.colors.layer2,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ fontWeight: "700", color: T.colors.text }}>Sign out</Text>
          </Pressable>
        </SurfaceCard>

        <Text style={{ marginTop: T.space.s16, marginBottom: T.space.s10, color: T.colors.textMuted }}>
          Tools & modules
        </Text>

        {consoleTools.map((row) => (
          <Pressable
            key={row.label}
            onPress={() => open(row.path)}
            style={{
              backgroundColor: T.colors.layer1,
              padding: T.space.s14,
              borderRadius: T.radii.card,
              marginBottom: T.space.s12,
              shadowColor: T.colors.shadow,
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 1
            }}
          >
            <Text style={{ fontWeight: "800", color: T.colors.text }}>{row.label}</Text>
            <Text style={{ marginTop: 4, color: T.colors.textMuted }}>
              {row.description ?? "Open in secure view"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
