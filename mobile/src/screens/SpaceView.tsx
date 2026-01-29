import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useAppState } from "../state/AppState";
import { GateLockCard } from "../ui/GateLockCard";
import { ChannelChat } from "./channels/ChannelChat";
import { Threads } from "./channels/Threads";
import { Digest } from "./channels/Digest";
import { joinSpace } from "../lib/gates";

const Tabs = createBottomTabNavigator();

export function SpaceView({ navigation, route }: any) {
  const { spaces, currentSpaceId, setCurrentSpaceId, hasSession } = useAppState();
  const routeSpaceId = route?.params?.spaceId as string | undefined;
  const spaceId = routeSpaceId ?? currentSpaceId ?? "";
  const space = useMemo(() => spaces.find((s) => s.id === spaceId) ?? null, [spaces, spaceId]);
  const [joined, setJoined] = useState<boolean>(false);

  useEffect(() => {
    if (!space) return;
    setJoined(Boolean(space.is_member) || !space.is_gated);
    if (spaceId && spaceId !== currentSpaceId) setCurrentSpaceId(spaceId);
  }, [spaceId, space?.id, space?.is_gated, space?.is_member]);

  const title = space?.name ?? "Space";

  const onUnlock = async () => {
    if (!hasSession) {
      navigation.navigate("Login");
      return;
    }
    await Haptics.selectionAsync();

    const res = await joinSpace(spaceId);
    if (res.ok) {
      setJoined(true);
      return;
    }

    if (res.reason === "wallet_required" || res.reason === "wallet_not_verified") {
      navigation.navigate("Wallets");
      return;
    }

    if (res.status === 402 || res.reason === "payment_required") {
      navigation.navigate("Wallets");
      return;
    }
  };

  if (!spaceId) {
    return (
      <View style={{ flex: 1, paddingTop: 58, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>No space selected</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: 14,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.10)",
          backgroundColor: "white"
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => navigation.openDrawer()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.12)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10
            }}
          >
            <Text style={{ fontSize: 18 }}>Menu</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
              {title}
            </Text>
            <Text style={{ marginTop: 2, opacity: 0.6 }} numberOfLines={1}>
              {space?.is_gated && !joined ? "Locked actions" : "Ready"}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate("Members", { spaceId })}
            style={{
              height: 36,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "rgba(0,0,0,0.06)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ fontWeight: "800" }}>Members</Text>
          </Pressable>
        </View>

        {space?.is_gated && !joined ? (
          <View style={{ marginTop: 12 }}>
            <GateLockCard
              title="This space is locked"
              subtitle="Join or unlock required to post, comment, and use DMs."
              cta={hasSession ? "Join or unlock" : "Sign in to unlock"}
              onPress={onUnlock}
            />
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Tabs.Navigator screenOptions={{ headerShown: false, tabBarStyle: { height: 58, paddingBottom: 10 } }}>
          <Tabs.Screen name="chat" options={{ tabBarLabel: "# chat" }}>
            {() => <ChannelChat spaceId={spaceId} locked={Boolean(space?.is_gated && !joined)} navigation={navigation} />}
          </Tabs.Screen>
          <Tabs.Screen name="threads" options={{ tabBarLabel: "# threads" }}>
            {() => <Threads spaceId={spaceId} locked={Boolean(space?.is_gated && !joined)} navigation={navigation} />}
          </Tabs.Screen>
          <Tabs.Screen name="digest" options={{ tabBarLabel: "# digest" }}>
            {() => <Digest spaceId={spaceId} navigation={navigation} />}
          </Tabs.Screen>
        </Tabs.Navigator>
      </View>
    </View>
  );
}
