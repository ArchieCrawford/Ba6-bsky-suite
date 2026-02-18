import React from "react";
import { View, Pressable, Text, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { useAppState } from "../state/AppState";
import { TownsBA6Theme as T } from "../ui/towns/theme";

export function SpaceSwitcherDrawer(props: DrawerContentComponentProps) {
  const { spaces, currentSpaceId, setCurrentSpaceId } = useAppState();

  return (
    <View style={{ flex: 1, paddingTop: 18, paddingHorizontal: 12, backgroundColor: T.colors.layer1 }}>
      <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 14, marginBottom: 12 }}>Spaces</Text>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {spaces.map((s) => {
          const active = s.id === currentSpaceId;
          const locked = Boolean(s.is_gated && !s.is_member);
          const initials = s.name
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join("")
            .slice(0, 2);
          return (
            <Pressable
              key={s.id}
              onPress={async () => {
                await Haptics.selectionAsync();
                setCurrentSpaceId(s.id);
                props.navigation.closeDrawer();
                props.navigation.navigate("Main" as never, {
                  screen: "SpaceView",
                  params: { spaceId: s.id }
                } as never);
              }}
              style={{
                marginBottom: 10,
                borderRadius: 16,
                padding: 10,
                backgroundColor: active ? T.colors.layer2 : "transparent"
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    backgroundColor: active ? T.colors.blue1 : T.colors.layer2,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: active ? "white" : T.colors.text, fontWeight: "800", fontSize: 12 }}>
                    {initials}
                  </Text>
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ color: T.colors.text, fontWeight: "800" }} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={{ marginTop: 2, color: T.colors.textMuted, fontSize: 11 }}>
                    {locked ? "Locked" : "Open"}
                  </Text>
                </View>
                {s.unread_count ? (
                  <View
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      paddingHorizontal: 5,
                      backgroundColor: T.colors.yellow,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Text style={{ color: T.colors.text, fontSize: 10, fontWeight: "800" }}>
                      {s.unread_count > 99 ? "99+" : s.unread_count}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={async () => {
          await Haptics.selectionAsync();
          props.navigation.closeDrawer();
          props.navigation.navigate("Main" as never, { screen: "SpacesHome" } as never);
        }}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: T.colors.layer2,
          marginBottom: 10
        }}
      >
        <Text style={{ color: T.colors.text, fontWeight: "800" }}>All spaces</Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          await Haptics.selectionAsync();
          props.navigation.closeDrawer();
          props.navigation.navigate("Main" as never, { screen: "Settings" } as never);
        }}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: T.colors.layer2,
          marginBottom: 24
        }}
      >
        <Text style={{ color: T.colors.text, fontWeight: "800" }}>Tools</Text>
      </Pressable>
    </View>
  );
}
