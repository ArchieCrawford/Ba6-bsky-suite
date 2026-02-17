import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { ScreenHeader } from "../ui/towns/ScreenHeader";
import { MessageBubble } from "../ui/towns/MessageBubble";
import { MessageInputBar } from "../ui/towns/MessageInputBar";
import { useAppState } from "../state/AppState";
import {
  GroupMessage,
  getGroupById,
  getMessages,
  sendMessage,
  subscribeToMessages
} from "../lib/groupsApi";
import { getSupabase } from "../lib/supabase";

export function GroupChat({ navigation, route }: any) {
  const { hasSession } = useAppState();
  const groupId = route?.params?.groupId as string;
  const initialName = route?.params?.groupName as string | undefined;

  const [groupName, setGroupName] = useState(initialName ?? "Group");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    const res = await getMessages(groupId);
    if (!res.error) setMessages(res.data);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setMyUserId(data.session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!groupId) return;
    if (!initialName) {
      getGroupById(groupId).then((res) => {
        if (res.data?.name) setGroupName(res.data.name);
      });
    }
  }, [groupId, initialName]);

  useEffect(() => {
    loadMessages().catch(() => {});
  }, [loadMessages]);

  useEffect(() => {
    if (!groupId) return;
    const channel = subscribeToMessages(groupId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [msg, ...prev];
      });
    });
    return () => {
      channel.unsubscribe();
    };
  }, [groupId]);

  const handleSend = async () => {
    if (!hasSession) {
      navigation.navigate("Login");
      return;
    }
    const body = text.trim();
    if (!body) return;

    await Haptics.selectionAsync();
    setText("");

    try {
      const msg = await sendMessage(groupId, body);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [msg, ...prev];
      });
    } catch {
      setText(body);
    }
  };

  const renderName = useCallback(
    (msg: GroupMessage, isMine: boolean) => {
      if (isMine) return "You";
      if (msg.profiles?.display_name) return msg.profiles.display_name;
      return "Member";
    },
    []
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={{ paddingTop: T.space.s16 }}>
          <ActivityIndicator color={T.colors.blue1} />
        </View>
      );
    }
    return (
      <View style={{ paddingTop: T.space.s16 }}>
        <Text style={{ color: T.colors.textMuted, fontWeight: "600" }}>No messages yet.</Text>
      </View>
    );
  }, [loading]);

  return (
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <ScreenHeader
        title={groupName}
        subtitle="Group chat"
        onPressBack={() => navigation.goBack?.()}
        backLabel="Groups"
        onPressAction={() => navigation.navigate("Settings")}
        actionLabel="Tools"
      />

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={{
          paddingHorizontal: T.space.s16,
          paddingTop: T.space.s12,
          paddingBottom: T.space.s24
        }}
        ListEmptyComponent={listEmpty}
        renderItem={({ item, index }) => {
          const next = messages[index + 1];
          const grouped = next && next.user_id === item.user_id;
          const isMine = Boolean(myUserId && item.user_id === myUserId);
          const ts = item.created_at
            ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";
          return (
            <MessageBubble
              mine={isMine}
              name={renderName(item, isMine)}
              body={item.body}
              ts={ts}
              showName={!grouped}
              showTimestamp={!grouped}
              compact={Boolean(grouped)}
            />
          );
        }}
      />

      <MessageInputBar value={text} onChangeText={setText} onSend={handleSend} placeholder="Message group" />
    </View>
  );
}
