import React, { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import * as Haptics from "expo-haptics";
import { checkGate } from "../lib/gates";
import { GateLockCard } from "../ui/GateLockCard";

type Msg = { id: string; body: string; side: "me" | "them" };

export function DMThread({ navigation, route }: any) {
  const did = route?.params?.did as string;
  const title = (route?.params?.title as string) ?? did;
  const [text, setText] = useState("");
  const [locked, setLocked] = useState(false);
  const [items, setItems] = useState<Msg[]>([
    { id: "t1", body: "DMs are gated by action=dm.", side: "them" }
  ]);

  const send = async () => {
    if (!text.trim()) return;

    const gate = await checkGate({ target_type: "dm", target_id: did, action: "dm" });
    if (!gate.ok) {
      setLocked(true);
      if (gate.reason === "wallet_required" || gate.reason === "wallet_not_verified") navigation.navigate("Wallets");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    await Haptics.selectionAsync();
    setItems((prev) => [{ id: `${Date.now()}`, body: text.trim(), side: "me" }, ...prev]);
    setText("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: 14,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.10)"
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ marginTop: 2, opacity: 0.65 }} numberOfLines={1}>
          {did}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.side === "me" ? "flex-end" : "flex-start", maxWidth: "82%", marginBottom: 10 }}>
            <View
              style={{
                padding: 12,
                borderRadius: 16,
                backgroundColor: item.side === "me" ? "rgba(0,0,0,0.86)" : "rgba(0,0,0,0.06)"
              }}
            >
              <Text style={{ color: item.side === "me" ? "white" : "black", opacity: item.side === "me" ? 1 : 0.88 }}>
                {item.body}
              </Text>
            </View>
          </View>
        )}
      />

      {locked ? (
        <View style={{ padding: 14 }}>
          <GateLockCard
            title="DM is locked"
            subtitle="Unlock is required before you can message this user."
            cta="Fix access"
            onPress={() => navigation.navigate("Wallets")}
          />
        </View>
      ) : (
        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: "rgba(0,0,0,0.10)",
            flexDirection: "row",
            gap: 10,
            alignItems: "center"
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            style={{
              flex: 1,
              height: 44,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
              borderRadius: 14,
              paddingHorizontal: 12
            }}
          />
          <Pressable
            onPress={send}
            style={{
              width: 56,
              height: 44,
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.85)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Send</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
