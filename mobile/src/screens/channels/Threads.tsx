import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { checkGate, GateCheckResult } from "../../lib/gates";
import { Theme } from "../../theme";

export function Threads({ spaceId, locked, navigation }: { spaceId: string; locked: boolean; navigation: any }) {
  const [gate, setGate] = useState<GateCheckResult | null>(null);

  useEffect(() => {
    let active = true;
    checkGate({ target_type: "space", target_id: spaceId, action: "comment" }).then((res) => {
      if (active) setGate(res);
    });
    return () => {
      active = false;
    };
  }, [spaceId]);

  const onNewThread = async () => {
    if (locked || (gate && !gate.ok)) return;
    await Haptics.selectionAsync();
  };

  return (
    <View style={{ flex: 1, padding: 14, backgroundColor: "white" }}>
      <Text style={{ fontSize: 16, fontWeight: "900" }}>Threads</Text>
      <Text style={{ marginTop: 6, opacity: 0.7 }}>Cards view (phase 1). Hook to real thread list later.</Text>

      {locked || (gate && !gate.ok) ? (
        <View style={{ marginTop: 14 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: Theme.colors.border,
              backgroundColor: Theme.colors.surface,
              padding: Theme.spacing.md,
              borderRadius: Theme.radius.lg
            }}
          >
            <Text style={{ fontWeight: "800", color: Theme.colors.text }}>Threads locked</Text>
            <Text style={{ marginTop: 6, color: Theme.colors.textMuted }}>
              {gate && !gate.ok
                ? gate.reason === "wallet_required" || gate.reason === "wallet_not_verified"
                  ? "Connect a wallet to create threads."
                  : gate.reason === "payment_required"
                  ? "Unlock required to create threads."
                  : "Access required to create threads."
                : "Access required to create threads."}
            </Text>
            <Pressable
              onPress={() => {
                if (gate && !gate.ok) {
                  if (gate.reason === "wallet_required" || gate.reason === "wallet_not_verified") {
                    navigation.navigate("Wallets");
                    return;
                  }
                  if (gate.reason === "payment_required") {
                    navigation.navigate("Settings");
                    return;
                  }
                }
              }}
              style={{
                marginTop: Theme.spacing.sm,
                height: 40,
                borderRadius: Theme.radius.md,
                backgroundColor: Theme.colors.primaryBlue2,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>Unlock</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={onNewThread}
          style={{
            marginTop: 14,
            height: 44,
            borderRadius: 14,
            backgroundColor: "rgba(0,0,0,0.85)",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>+ New Thread</Text>
        </Pressable>
      )}
    </View>
  );
}
