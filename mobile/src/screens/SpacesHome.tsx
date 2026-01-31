import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useAppState } from "../state/AppState";
import { Theme } from "../theme";
import { SpaceCard } from "../components/SpaceCard";
import { joinSpace } from "../lib/gates";

export function SpacesHome({ navigation }: any) {
  const { spaces } = useAppState();

  return (
    <View style={{ flex: 1, backgroundColor: Theme.colors.primaryBlue }}>
      <View style={{ paddingTop: 60, paddingHorizontal: Theme.spacing.lg, paddingBottom: Theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: "white" }}>Spaces</Text>
          <Pressable
            onPress={() => navigation.navigate("Settings")}
            style={{
              height: 36,
              paddingHorizontal: 12,
              borderRadius: Theme.radius.md,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Settings</Text>
          </Pressable>
        </View>
        <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.75)" }}>
          Calm, focused spaces for chat, threads, and digest tools.
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: Theme.colors.surface,
          borderTopLeftRadius: Theme.radius.xl,
          borderTopRightRadius: Theme.radius.xl,
          paddingHorizontal: Theme.spacing.lg,
          paddingTop: Theme.spacing.lg
        }}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: Theme.spacing.xl }}>
          {spaces.map((s) => (
            <SpaceCard
              key={s.id}
              space={s}
              onOpen={() => navigation.navigate("SpaceView", { spaceId: s.id })}
              onJoin={async () => {
                const res = await joinSpace(s.id);
                if (res.ok) navigation.navigate("SpaceView", { spaceId: s.id });
              }}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
