import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppState } from "../state/AppState";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { SurfaceCard } from "../ui/towns/SurfaceCard";

export function AccessGate({ navigation }: any) {
  const { hasSession } = useAppState();

  return (
    <View
      style={{
        flex: 1,
        paddingTop: 64,
        paddingHorizontal: T.space.s16,
        backgroundColor: T.colors.bg
      }}
    >
      <SurfaceCard padding={T.space.s16}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: T.colors.text }}>Access required</Text>
        <Text style={{ marginTop: 8, color: T.colors.textMuted }}>
          Sign in to join groups, post in chat, and unlock gated actions.
        </Text>
        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={{
            marginTop: T.space.s12,
            height: 44,
            borderRadius: T.radii.pill,
            backgroundColor: T.colors.blue1,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>{hasSession ? "Continue" : "Sign in"}</Text>
        </Pressable>
      </SurfaceCard>
    </View>
  );
}
