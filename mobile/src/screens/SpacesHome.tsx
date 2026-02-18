import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useAppState } from "../state/AppState";
import { SpaceCard } from "../components/SpaceCard";
import { joinSpace } from "../lib/gates";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { ScreenHeader } from "../ui/towns/ScreenHeader";

export function SpacesHome({ navigation }: any) {
  const { spaces } = useAppState();

  return (
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -120,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: 200,
          backgroundColor: "rgba(11,60,255,0.10)"
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 20,
          left: -80,
          width: 200,
          height: 200,
          borderRadius: 180,
          backgroundColor: "rgba(10,30,106,0.12)"
        }}
      />

      <ScreenHeader
        title="Spaces"
        subtitle="Calm, focused spaces for chat, threads, and digest tools."
        onPressAction={() => navigation.navigate("Settings")}
        actionLabel="Tools"
      />

      <View
        style={{
          flex: 1,
          backgroundColor: T.colors.bg,
          paddingHorizontal: T.space.s16,
          paddingTop: T.space.s16
        }}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: T.space.s24 }}>
          <Text
            style={{
              color: T.colors.textMuted,
              fontSize: 12,
              fontWeight: "700",
              marginBottom: T.space.s10
            }}
          >
            Your spaces
          </Text>
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
