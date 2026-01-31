import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useAppState } from "../state/AppState";

export function SpacesHome({ navigation }: any) {
  const { spaces } = useAppState();

  return (
    <View style={{ flex: 1, paddingTop: 58, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 26, fontWeight: "900" }}>Spaces</Text>
      <Text style={{ marginTop: 6, opacity: 0.65 }}>
        Spaces are the home for chat, threads, and digest tools.
      </Text>

      <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={() => navigation.navigate("ConsoleHome")}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 14,
            backgroundColor: "rgba(0,0,0,0.85)",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>Open BA6 Console</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("ClankerLauncher")}
          style={{
            height: 44,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.12)",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white"
          }}
        >
          <Text style={{ fontWeight: "900" }}>Clanker</Text>
        </Pressable>
      </View>

      <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {spaces.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => navigation.navigate("SpaceView", { spaceId: s.id })}
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              padding: 14,
              borderRadius: 16,
              marginBottom: 12,
              backgroundColor: "white"
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900" }}>{s.name}</Text>
            <Text style={{ marginTop: 6, opacity: 0.7 }}>
              /{s.slug} - {s.join_mode ?? "public"}
              {s.is_gated ? " - gated" : ""}
              {s.unread_count ? ` - ${s.unread_count} unread` : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
