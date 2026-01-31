import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import * as Haptics from "expo-haptics";
import { checkGate, GateCheckResult } from "../lib/gates";
import { Theme } from "../theme";
import { AccessGate } from "../components/AccessGate";

type Msg = { id: string; body: string; side: "me" | "them" };

export function DMThread({ navigation, route }: any) {
  const did = route?.params?.did as string;
  const title = (route?.params?.title as string) ?? did;
  const [text, setText] = useState("");
  const [gate, setGate] = useState<GateCheckResult | null>(null);
  const [items, setItems] = useState<Msg[]>([
    { id: "t1", body: "Welcome to DMs.", side: "them" }
  ]);

  useEffect(() => {
    let active = true;
    checkGate({ target_type: "dm", target_id: did, action: "dm" }).then((res) => {
      if (active) setGate(res);
    });
    return () => {
      active = false;
    };
  }, [did]);

  const send = async () => {
    if (!text.trim()) return;

    if (gate && !gate.ok) return;

    await Haptics.selectionAsync();
    setItems((prev) => [{ id: `${Date.now()}`, body: text.trim(), side: "me" }, ...prev]);
    setText("");
  };

  if (gate && !gate.ok) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.colors.surface }}>
        <View style={{ paddingTop: 54, paddingHorizontal: Theme.spacing.lg }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: Theme.colors.text }} numberOfLines={1}>
            {title}
          </Text>
          <Text style={{ marginTop: 2, color: Theme.colors.textMuted }} numberOfLines={1}>
            {did}
          </Text>
        </View>
        <View style={{ padding: Theme.spacing.lg }}>
          <AccessGate
            title="DMs locked"
            subtitle={
              gate.reason === "wallet_required" || gate.reason === "wallet_not_verified"
                ? "Connect a wallet to unlock messaging."
                : gate.reason === "payment_required"
                ? "Unlock required before you can DM."
                : "Access required to use DMs."
            }
            ctaLabel="Unlock messaging"
            onPress={() => {
              if (gate.reason === "wallet_required" || gate.reason === "wallet_not_verified") {
                navigation.navigate("Wallets");
                return;
              }
              if (gate.reason === "payment_required") {
                navigation.navigate("Settings");
                return;
              }
            }}
            secondaryLabel="Back"
            onSecondary={() => navigation.goBack?.()}
          />
        </View>
      </View>
    );
  }

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
            backgroundColor: Theme.colors.primaryBlue2,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
