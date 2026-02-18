import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useAppState } from "../state/AppState";
import { AccessGate } from "../components/AccessGate";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { ChannelChat } from "./channels/ChannelChat";
import { Threads } from "./channels/Threads";
import { Digest } from "./channels/Digest";
import { joinSpace } from "../lib/gates";
import { consoleTools, buildConsoleUrl } from "../lib/consoleTools";
import { SpaceHeader } from "../ui/towns/SpaceHeader";

const Tabs = createBottomTabNavigator();

export function SpaceView({ navigation, route }: any) {
  const { spaces, currentSpaceId, setCurrentSpaceId, hasSession } = useAppState();
  const routeSpaceId = route?.params?.spaceId as string | undefined;
  const spaceId = routeSpaceId ?? currentSpaceId ?? "";
  const space = useMemo(() => spaces.find((s) => s.id === spaceId) ?? null, [spaces, spaceId]);
  const [joined, setJoined] = useState<boolean>(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    if (!space) return;
    setJoined(Boolean(space.is_member) || !space.is_gated);
    if (spaceId && spaceId !== currentSpaceId) setCurrentSpaceId(spaceId);
  }, [spaceId, space?.id, space?.is_gated, space?.is_member]);

  const title = space?.name ?? "Space";
  const locked = Boolean(space?.is_gated && !joined);

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
      <View style={{ flex: 1, paddingTop: 58, paddingHorizontal: 16, backgroundColor: T.colors.bg }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: T.colors.text }}>No space selected</Text>
      </View>
    );
  }

  const openConsole = async (path: string) => {
    setToolsOpen(false);
    const url = buildConsoleUrl(path);
    if (!url) return;
    await WebBrowser.openBrowserAsync(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <SpaceHeader
        title={title}
        statusLabel={locked ? "Locked" : "Live"}
        statusTone={locked ? "muted" : "live"}
        onPressSpaces={() => navigation.openDrawer()}
        onPressTools={() => setToolsOpen(true)}
      />

      <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
        {locked ? (
          <View style={{ padding: T.space.s16 }}>
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
              sceneContainerStyle: { backgroundColor: T.colors.bg },
              tabBarStyle: {
                height: 60,
                paddingBottom: 10,
                paddingTop: 6,
                backgroundColor: T.colors.layer1,
                borderTopWidth: 0,
                shadowColor: T.colors.shadow,
                shadowOpacity: 0.18,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: -4 },
                elevation: 4
              },
              tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
              tabBarActiveTintColor: T.colors.blue1,
              tabBarInactiveTintColor: T.colors.textMuted
            }}
          >
            <Tabs.Screen name="chat" options={{ tabBarLabel: "Chat" }}>
              {() => (
                <ChannelChat
                  spaceId={spaceId}
                  locked={false}
                  navigation={navigation}
                  showHeader={false}
                  onPressTools={() => setToolsOpen(true)}
                />
              )}
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

      {toolsOpen ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "flex-end"
          }}
        >
          <Pressable
            onPress={() => setToolsOpen(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(11,15,22,0.18)"
            }}
          />
          <View style={{ padding: T.space.s16 }}>
            <View
              style={{
                backgroundColor: T.colors.layer1,
                borderRadius: T.radii.card,
                padding: T.space.s14,
                shadowColor: T.colors.shadow,
                shadowOpacity: 0.18,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: -2 },
                elevation: 3
              }}
            >
              <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 16 }}>Space tools</Text>
              <Text style={{ marginTop: 4, color: T.colors.textMuted, fontSize: 12 }}>
                Roles, members, and console access for this space.
              </Text>

              <View style={{ marginTop: T.space.s12 }}>
                <Pressable
                  onPress={() => {
                    setToolsOpen(false);
                    navigation.navigate("Members", { spaceId });
                  }}
                  style={{
                    paddingVertical: T.space.s10,
                    paddingHorizontal: T.space.s12,
                    borderRadius: T.radii.pill,
                    backgroundColor: T.colors.layer2,
                    marginBottom: T.space.s8
                  }}
                >
                  <Text style={{ color: T.colors.text, fontWeight: "700" }}>Members</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setToolsOpen(false);
                    navigation.navigate("Settings");
                  }}
                  style={{
                    paddingVertical: T.space.s10,
                    paddingHorizontal: T.space.s12,
                    borderRadius: T.radii.pill,
                    backgroundColor: T.colors.layer2
                  }}
                >
                  <Text style={{ color: T.colors.text, fontWeight: "700" }}>Space settings</Text>
                </Pressable>
              </View>

              <Text style={{ marginTop: T.space.s16, color: T.colors.textMuted, fontSize: 12, fontWeight: "700" }}>
                Console
              </Text>
              <View style={{ marginTop: T.space.s10, maxHeight: 260 }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {consoleTools.map((tool) => (
                    <Pressable
                      key={tool.label}
                      onPress={() => openConsole(tool.path)}
                      style={{
                        paddingVertical: T.space.s10,
                        paddingHorizontal: T.space.s12,
                        borderRadius: T.radii.pill,
                        backgroundColor: T.colors.layer2,
                        marginBottom: T.space.s8
                      }}
                    >
                      <Text style={{ color: T.colors.text, fontWeight: "700" }}>{tool.label}</Text>
                      {tool.description ? (
                        <Text style={{ marginTop: 2, color: T.colors.textMuted, fontSize: 11 }}>
                          {tool.description}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
