import React from "react";
import { View, Text, Pressable } from "react-native";
import { Space } from "../types/models";
import { TownsBA6Theme as T } from "../ui/towns/theme";

export function SpaceCard({
  space,
  onOpen,
  onJoin
}: {
  space: Space;
  onOpen: () => void;
  onJoin?: () => void;
}) {
  const locked = Boolean(space.is_gated && !space.is_member);

  return (
    <Pressable
      onPress={onOpen}
      style={{
        padding: T.space.s14,
        borderRadius: T.radii.card,
        backgroundColor: T.colors.layer1,
        marginBottom: T.space.s12,
        shadowColor: T.colors.shadow,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 1
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: T.space.s12 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: T.colors.text }} numberOfLines={1}>
            {space.name}
          </Text>
          <Text style={{ marginTop: 6, color: T.colors.textMuted }} numberOfLines={1}>
            /{space.slug} · {space.join_mode ?? "public"}
          </Text>
        </View>
        {space.unread_count ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              paddingHorizontal: 6,
              backgroundColor: T.colors.yellow,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: T.colors.text, fontSize: 12, fontWeight: "800" }}>
              {space.unread_count}
            </Text>
          </View>
        ) : null}
      </View>

      {locked ? (
        <View style={{ marginTop: T.space.s10, flexDirection: "row", gap: 10 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: T.colors.layer2
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: T.colors.text }}>
              Locked
            </Text>
          </View>
          {onJoin ? (
            <Pressable
              onPress={onJoin}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: T.colors.blue1
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: "white" }}>Join / Unlock</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
