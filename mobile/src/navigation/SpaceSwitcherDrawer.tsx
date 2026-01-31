import React from "react";
import { View, Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { useAppState } from "../state/AppState";
import { SpaceIcon } from "../ui/SpaceIcon";
import { Theme } from "../theme";

export function SpaceSwitcherDrawer(props: DrawerContentComponentProps) {
  const { spaces, currentSpaceId, setCurrentSpaceId } = useAppState();

  return (
    <View style={{ flex: 1, paddingTop: 18, alignItems: "center", backgroundColor: Theme.colors.primaryBlue }}>
      {spaces.map((s) => {
        const active = s.id === currentSpaceId;
        const locked = Boolean(s.is_gated && !s.is_member);
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
            style={{ marginBottom: 12, opacity: active ? 1 : 0.85 }}
          >
            <SpaceIcon
              label={s.name}
              active={active}
              locked={locked}
              unread={Number(s.unread_count ?? 0)}
            />
          </Pressable>
        );
      })}

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={async () => {
          await Haptics.selectionAsync();
          props.navigation.closeDrawer();
          props.navigation.navigate("Main" as never, { screen: "SpacesHome" } as never);
        }}
        style={{ marginBottom: 16 }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.35)",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.15)"
          }}
        >
          <Text style={{ fontSize: 22, color: "white" }}>+</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={async () => {
          await Haptics.selectionAsync();
          props.navigation.closeDrawer();
          props.navigation.navigate("Main" as never, { screen: "Settings" } as never);
        }}
        style={{ marginBottom: 24 }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.35)",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.15)"
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: "white" }}>SET</Text>
        </View>
      </Pressable>
    </View>
  );
}
