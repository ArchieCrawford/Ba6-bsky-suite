import React from "react";
import { View, Text, Pressable } from "react-native";
import { Theme } from "../theme";
import { useAppState } from "../state/AppState";

export function AccessGate({ navigation }: any) {
  const { hasSession } = useAppState();

  return (
    <View
      style={{
        flex: 1,
        paddingTop: 64,
        paddingHorizontal: Theme.spacing.lg,
        backgroundColor: Theme.colors.primaryBlue
      }}
    >
      <View
        style={{
          padding: Theme.spacing.lg,
          borderRadius: Theme.radius.xl,
          backgroundColor: Theme.colors.surface,
          borderWidth: 1,
          borderColor: Theme.colors.border
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: Theme.colors.text }}>
          Access required
        </Text>
        <Text style={{ marginTop: 8, color: Theme.colors.textMuted }}>
          Sign in to join spaces, post in chat, and unlock gated actions.
        </Text>
        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={{
            marginTop: Theme.spacing.md,
            height: 44,
            borderRadius: Theme.radius.md,
            backgroundColor: Theme.colors.primaryBlue2,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>
            {hasSession ? "Continue" : "Sign in"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
