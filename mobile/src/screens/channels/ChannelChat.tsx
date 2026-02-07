import React, { useEffect, useMemo, useState } from "react";
import { View, FlatList } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppState } from "../../state/AppState";
import { shortDid } from "../../lib/format";
import { checkGate, GateCheckResult } from "../../lib/gates";
import { TownsBA6Theme as T } from "../../ui/towns/theme";
import { ChatHeader } from "../../ui/towns/ChatHeader";
import { MessageBubble } from "../../ui/towns/MessageBubble";
import { MessageInputBar } from "../../ui/towns/MessageInputBar";

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
  const { hasSession, identity, email, spaces } = useAppState();
  const [text, setText] = useState("");
  const [items, setItems] = useState<ChatMsg[]>(demo);
  const [gate, setGate] = useState<GateCheckResult | null>(null);

  const me = useMemo(() => {
    if (identity?.handle) return `@${identity.handle}`;
    if (identity?.did) return shortDid(identity.did);
    return email ?? "me";
  }, [identity, email]);

  const spaceName = useMemo(() => {
    const space = spaces.find((s) => s.id === spaceId);
    return space?.name ?? "Space";
  }, [spaces, spaceId]);

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

  const isLocked = locked || (gate && !gate.ok);
  const lockedText =
    gate && !gate.ok
      ? gate.reason === "payment_required"
        ? "Unlock required to post in chat."
        : gate.reason === "wallet_required" || gate.reason === "wallet_not_verified"
        ? "Connect a wallet to post in chat."
        : "Access required to post in chat."
      : "Access required to post in chat.";

  return (
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <ChatHeader
        title={spaceName}
        subtitle="#chat"
        statusLabel={isLocked ? "Locked" : "Live"}
        statusTone={isLocked ? "muted" : "live"}
        onPressTools={() => navigation.navigate("Settings")}
      />

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
          const grouped = next && next.name === item.name;
          return (
            <MessageBubble
              mine={item.name === me}
              name={item.name}
              body={item.body}
              ts={item.ts}
              showName={!grouped}
              showTimestamp={!grouped}
              compact={Boolean(grouped)}
            />
          );
        }}
      />

      <MessageInputBar
        value={text}
        onChangeText={setText}
        onSend={onSend}
        locked={Boolean(isLocked)}
        lockedText={lockedText}
        lockedCta={hasSession ? "Unlock messaging" : "Sign in"}
        onPressCta={() => {
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
      />
    </View>
  );
}
