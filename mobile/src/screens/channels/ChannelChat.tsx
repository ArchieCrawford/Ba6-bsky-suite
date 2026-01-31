import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TextInput, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppState } from "../../state/AppState";
import { shortDid } from "../../lib/format";
import { checkGate, GateCheckResult } from "../../lib/gates";
import { Theme } from "../../theme";

type ChatMsg = { id: string; name: string; body: string; ts: string };

const demo: ChatMsg[] = [
  { id: "m1", name: "@ba6", body: "Welcome to #chat.", ts: "now" },
  { id: "m2", name: "did:ba6:demo", body: "Locked actions show a clear CTA.", ts: "now" }
];

export function ChannelChat({
  spaceId,
  locked,
  navigation
}: {
  spaceId: string;
  locked: boolean;
  navigation: any;
}) {
  const { hasSession, identity, email } = useAppState();
  const [text, setText] = useState("");
  const [items, setItems] = useState<ChatMsg[]>(demo);
  const [gate, setGate] = useState<GateCheckResult | null>(null);

  const me = useMemo(() => {
    if (identity?.handle) return `@${identity.handle}`;
    if (identity?.did) return shortDid(identity.did);
    return email ?? "me";
  }, [identity, email]);

  useEffect(() => {
    let active = true;
    checkGate({ target_type: "space", target_id: spaceId, action: "post" }).then((res) => {
      if (active) setGate(res);
    });
    return () => {
      active = false;
    };
  }, [spaceId]);

  const onSend = async () => {
    if (!hasSession) {
      navigation.navigate("Login");
      return;
    }
    if (!text.trim()) return;
    if (locked || (gate && !gate.ok)) return;

    await Haptics.selectionAsync();
    const msg: ChatMsg = { id: `${Date.now()}`, name: me, body: text.trim(), ts: "now" };
    setItems((prev) => [msg, ...prev]);
    setText("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
        renderItem={({ item }) => (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontWeight: "900" }}>{item.name}</Text>
            <Text style={{ marginTop: 4, opacity: 0.86 }}>{item.body}</Text>
          </View>
        )}
      />

      {locked || (gate && !gate.ok) ? (
        <View style={{ padding: 14 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: Theme.colors.border,
              backgroundColor: Theme.colors.surface,
              padding: Theme.spacing.md,
              borderRadius: Theme.radius.lg
            }}
          >
            <Text style={{ fontWeight: "800", color: Theme.colors.text }}>Locked</Text>
            <Text style={{ marginTop: 6, color: Theme.colors.textMuted }}>
              {gate && !gate.ok
                ? gate.reason === "payment_required"
                  ? "Unlock required to post in chat."
                  : gate.reason === "wallet_required" || gate.reason === "wallet_not_verified"
                  ? "Connect a wallet to post in chat."
                  : "Access required to post in chat."
                : "Access required to post in chat."}
            </Text>
            <Pressable
              onPress={() => {
                if (!hasSession) {
                  navigation.navigate("Login");
                  return;
                }
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
              <Text style={{ color: "white", fontWeight: "800" }}>
                {hasSession ? "Unlock" : "Sign in"}
              </Text>
            </Pressable>
          </View>
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
            placeholder="Message #chat"
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
            onPress={onSend}
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
