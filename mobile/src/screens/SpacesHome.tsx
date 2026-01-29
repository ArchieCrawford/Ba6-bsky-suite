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
