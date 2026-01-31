import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useAppState } from "../state/AppState";
import { AccessGate } from "../components/AccessGate";
import { Theme } from "../theme";
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
    <View style={{ flex: 1, backgroundColor: Theme.colors.primaryBlue }}>
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: Theme.spacing.lg,
          paddingBottom: Theme.spacing.md,
          backgroundColor: Theme.colors.primaryBlue
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => navigation.openDrawer()}
            style={{
              width: 42,
              height: 42,
              borderRadius: Theme.radius.md,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.35)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10
            }}
          >
            <Text style={{ fontSize: 16, color: "white", fontWeight: "800" }}>≡</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "white" }} numberOfLines={1}>
              {title}
            </Text>
            <Text style={{ marginTop: 2, color: "rgba(255,255,255,0.7)" }} numberOfLines={1}>
              {space?.is_gated && !joined ? "Access required" : "Ready"}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate("Settings")}
            style={{
              height: 34,
              paddingHorizontal: 12,
              borderRadius: Theme.radius.md,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Tools</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Members", { spaceId })}
            style={{
              height: 34,
              paddingHorizontal: 12,
              borderRadius: Theme.radius.md,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Members</Text>
          </Pressable>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: Theme.colors.surface,
          borderTopLeftRadius: Theme.radius.xl,
          borderTopRightRadius: Theme.radius.xl
        }}
      >
        {space?.is_gated && !joined ? (
          <View style={{ padding: Theme.spacing.lg }}>
            <AccessGate
              title="Unlock this space"
              subtitle="Join or unlock to access chat, threads, and DMs."
              ctaLabel={hasSession ? "Join / Unlock" : "Sign in"}
              onPress={onUnlock}
              secondaryLabel="Back to spaces"
              onSecondary={() => navigation.navigate("SpacesHome")}
            />
          </View>
        ) : (
          <Tabs.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: { height: 58, paddingBottom: 8, backgroundColor: "white" },
              tabBarActiveTintColor: Theme.colors.primaryBlue2,
              tabBarInactiveTintColor: Theme.colors.textMuted
            }}
          >
            <Tabs.Screen name="chat" options={{ tabBarLabel: "Chat" }}>
              {() => <ChannelChat spaceId={spaceId} locked={false} navigation={navigation} />}
            </Tabs.Screen>
            <Tabs.Screen name="threads" options={{ tabBarLabel: "Threads" }}>
              {() => <Threads spaceId={spaceId} locked={false} navigation={navigation} />}
            </Tabs.Screen>
            <Tabs.Screen name="digest" options={{ tabBarLabel: "Digest" }}>
              {() => <Digest spaceId={spaceId} navigation={navigation} />}
            </Tabs.Screen>
          </Tabs.Navigator>
        )}
      </View>
    </View>
  );
}
