import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, FlatList, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppState } from "../../state/AppState";
import { shortDid } from "../../lib/format";
import { checkGate, GateCheckResult } from "../../lib/gates";
import { apiFetch } from "../../lib/api";
import { getSupabase } from "../../lib/supabase";
import { TownsBA6Theme as T } from "../../ui/towns/theme";
import { ChatHeader } from "../../ui/towns/ChatHeader";
import { MessageBubble } from "../../ui/towns/MessageBubble";
import { MessageInputBar } from "../../ui/towns/MessageInputBar";

type ChatMsg = { id: string; userId: string; name: string; body: string; ts: string };
type MessageRow = { id: string; body: string; created_at: string; user_id: string };
type IdentityRow = { user_id: string; handle: string | null; username: string | null; did: string | null };

export function ChannelChat({
  spaceId,
  locked,
  navigation,
  showHeader = true,
  onPressTools
}: {
  spaceId: string;
  locked: boolean;
  navigation: any;
  showHeader?: boolean;
  onPressTools?: () => void;
}) {
  const { hasSession, identity, email, spaces } = useAppState();
  const [text, setText] = useState("");
  const [items, setItems] = useState<ChatMsg[]>([]);
  const [gate, setGate] = useState<GateCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const me = useMemo(() => {
    if (identity?.handle) return `@${identity.handle}`;
    if (identity?.did) return shortDid(identity.did);
    return email ?? "me";
  }, [identity, email]);

  const spaceName = useMemo(() => {
    const space = spaces.find((s) => s.id === spaceId);
    return space?.name ?? "Space";
  }, [spaces, spaceId]);

  const loadMessages = useCallback(async () => {
    const supabase = getSupabase();
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;
    setMyUserId(userId);

    const { data, error } = await supabase
      .from("space_messages")
      .select("id,body,created_at,user_id")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as MessageRow[];
    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    let identities: IdentityRow[] = [];
    if (userIds.length) {
      const { data: identityRows } = await supabase
        .from("identities")
        .select("user_id,handle,username,did")
        .in("user_id", userIds);
      identities = (identityRows ?? []) as IdentityRow[];
    }

    const identityMap = new Map<string, IdentityRow>();
    identities.forEach((row) => identityMap.set(row.user_id, row));

    const formatted = rows.map((row) => {
      const ident = identityMap.get(row.user_id);
      const display =
        ident?.handle ? `@${ident.handle}` : ident?.username ? `@${ident.username}` : ident?.did ? shortDid(ident.did) : row.user_id.slice(0, 8);
      const ts = row.created_at
        ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
      return { id: row.id, userId: row.user_id, name: display, body: row.body, ts };
    });

    setItems(formatted);
    setLoading(false);
  }, [spaceId]);

  useEffect(() => {
    let active = true;
    checkGate({ target_type: "space", target_id: spaceId, action: "send_message" }).then((res) => {
      if (active) setGate(res);
    });
    return () => {
      active = false;
    };
  }, [spaceId]);

  useEffect(() => {
    loadMessages().catch(() => {});
  }, [loadMessages]);

  const onSend = async () => {
    if (!hasSession) {
      navigation.navigate("Login");
      return;
    }
    if (!text.trim()) return;
    if (locked || (gate && !gate.ok)) return;

    await Haptics.selectionAsync();
    const body = text.trim();
    const optimistic: ChatMsg = {
      id: `local-${Date.now()}`,
      userId: myUserId ?? "me",
      name: me,
      body,
      ts: "now"
    };
    setItems((prev) => [optimistic, ...prev]);
    setText("");

    const res = await apiFetch<{ ok: boolean }>("/api/spaces/messages/send", {
      method: "POST",
      body: JSON.stringify({ space_id: spaceId, body })
    });
    if (res.ok) {
      await loadMessages();
    }
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
      {showHeader ? (
        <ChatHeader
          title={spaceName}
          subtitle="#chat"
          statusLabel={isLocked ? "Locked" : "Live"}
          statusTone={isLocked ? "muted" : "live"}
          onPressTools={onPressTools ?? (() => navigation.navigate("Settings"))}
        />
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={{
          paddingHorizontal: T.space.s16,
          paddingTop: T.space.s12,
          paddingBottom: T.space.s24
        }}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: T.space.s16 }}>
              <Text style={{ color: T.colors.textMuted, fontWeight: "600" }}>Loading messages...</Text>
            </View>
          ) : (
            <View style={{ paddingTop: T.space.s16 }}>
              <Text style={{ color: T.colors.textMuted, fontWeight: "600" }}>No messages yet.</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const next = items[index + 1];
          const grouped = next && next.userId === item.userId;
          return (
            <MessageBubble
              mine={Boolean(myUserId && item.userId === myUserId)}
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
