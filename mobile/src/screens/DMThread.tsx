import React, { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import * as Haptics from "expo-haptics";
import { checkGate, GateCheckResult } from "../lib/gates";
import { AccessGate } from "../components/AccessGate";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { ChatHeader } from "../ui/towns/ChatHeader";
import { MessageBubble } from "../ui/towns/MessageBubble";
import { MessageInputBar } from "../ui/towns/MessageInputBar";

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
      <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
        <ChatHeader
          title={title}
          subtitle={did}
          statusLabel="Locked"
          statusTone="muted"
          onPressTools={() => navigation.goBack?.()}
        />
        <View style={{ padding: T.space.s16 }}>
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
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <ChatHeader title={title} subtitle={did} statusLabel="Live" statusTone="live" onPressTools={() => navigation.goBack?.()} />

      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={{
          paddingHorizontal: T.space.s16,
          paddingTop: T.space.s12,
          paddingBottom: T.space.s24
        }}
        renderItem={({ item, index }) => {
          const next = items[index + 1];
          const grouped = next && next.side === item.side;
          const name = item.side === "me" ? "You" : title;
          return (
            <MessageBubble
              mine={item.side === "me"}
              name={name}
              body={item.body}
              showName={!grouped}
              showTimestamp={!grouped}
              compact={Boolean(grouped)}
            />
          );
        }}
      />

      <MessageInputBar value={text} onChangeText={setText} onSend={send} placeholder="Message" />
    </View>
  );
}
