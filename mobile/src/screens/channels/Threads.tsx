import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { checkGate, GateCheckResult } from "../../lib/gates";
import { TownsBA6Theme as T } from "../../ui/towns/theme";
import { SurfaceCard } from "../../ui/towns/SurfaceCard";

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

  const isLocked = locked || (gate && !gate.ok);
  const lockedText =
    gate && !gate.ok
      ? gate.reason === "wallet_required" || gate.reason === "wallet_not_verified"
        ? "Connect a wallet to create threads."
        : gate.reason === "payment_required"
        ? "Unlock required to create threads."
        : "Access required to create threads."
      : "Access required to create threads.";

  return (
    <View style={{ flex: 1, padding: T.space.s16, backgroundColor: T.colors.bg }}>
      <Text style={{ fontSize: 16, fontWeight: "900", color: T.colors.text }}>Threads</Text>
      <Text style={{ marginTop: 6, color: T.colors.textMuted }}>
        Longer discussions and updates live here.
      </Text>

      {isLocked ? (
        <View style={{ marginTop: T.space.s14 }}>
          <SurfaceCard>
            <Text style={{ fontWeight: "800", color: T.colors.text }}>Threads locked</Text>
            <Text style={{ marginTop: 6, color: T.colors.textMuted }}>{lockedText}</Text>
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
                marginTop: T.space.s12,
                height: 40,
                borderRadius: T.radii.pill,
                backgroundColor: T.colors.blue1,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>Unlock</Text>
            </Pressable>
          </SurfaceCard>
        </View>
      ) : (
        <Pressable
          onPress={onNewThread}
          style={{
            marginTop: T.space.s14,
            height: 44,
            borderRadius: T.radii.pill,
            backgroundColor: T.colors.blue1,
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
