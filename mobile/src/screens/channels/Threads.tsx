import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { GateLockCard } from "../../ui/GateLockCard";
import { checkGate } from "../../lib/gates";

export function Threads({ spaceId, locked, navigation }: { spaceId: string; locked: boolean; navigation: any }) {
  const onNewThread = async () => {
    if (locked) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const gate = await checkGate({ target_type: "space", target_id: spaceId, action: "create_thread" });
    if (!gate.ok) {
      if (gate.reason === "wallet_required" || gate.reason === "wallet_not_verified") navigation.navigate("Wallets");
      return;
    }
    await Haptics.selectionAsync();
  };

  return (
    <View style={{ flex: 1, padding: 14, backgroundColor: "white" }}>
      <Text style={{ fontSize: 16, fontWeight: "900" }}>Threads</Text>
      <Text style={{ marginTop: 6, opacity: 0.7 }}>Cards view (phase 1). Hook to real thread list later.</Text>

      {locked ? (
        <View style={{ marginTop: 14 }}>
          <GateLockCard
            title="Threads are locked"
            subtitle="Unlock this space to create or reply to threads."
            cta="Join or unlock"
            onPress={() => navigation.navigate("SpaceView", { spaceId })}
          />
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
