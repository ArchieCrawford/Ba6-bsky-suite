import React from "react";
import { View, Text, Pressable } from "react-native";
import { Theme } from "../theme";
import { Space } from "../types/models";

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
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: Theme.spacing.md,
        borderRadius: Theme.radius.lg,
        backgroundColor: "white",
        marginBottom: Theme.spacing.sm
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: Theme.spacing.sm }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: Theme.colors.text }}>
            {space.name}
          </Text>
          <Text style={{ marginTop: 6, color: Theme.colors.textMuted }}>
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
              backgroundColor: Theme.colors.primaryBlue2,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: "white", fontSize: 12, fontWeight: "800" }}>
              {space.unread_count}
            </Text>
          </View>
        ) : null}
      </View>

      {locked ? (
        <View style={{ marginTop: Theme.spacing.sm, flexDirection: "row", gap: 10 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.06)"
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: Theme.colors.text }}>
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
                backgroundColor: Theme.colors.accentYellow
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: Theme.colors.text }}>
                Join / Unlock
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
