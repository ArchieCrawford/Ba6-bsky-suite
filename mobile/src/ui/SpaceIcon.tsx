import React from "react";
import { View, Text } from "react-native";

export function SpaceIcon({
  label,
  active,
  locked,
  unread
}: {
  label: string;
  active?: boolean;
  locked?: boolean;
  unread?: number;
}) {
  const initials = label
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "rgba(0,0,0,0.06)",
          borderWidth: active ? 2 : 1,
          borderColor: active ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.12)",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700" }}>{initials}</Text>

        {locked ? (
          <View
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: "rgba(0,0,0,0.72)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: "white", fontSize: 9, fontWeight: "700" }}>LOCK</Text>
          </View>
        ) : null}

        {unread && unread > 0 ? (
          <View
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 5,
              backgroundColor: "rgba(0,0,0,0.8)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
              {unread > 99 ? "99+" : unread}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
