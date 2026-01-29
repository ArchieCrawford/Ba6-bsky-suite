import React from "react";
import { View, Text } from "react-native";

export function Avatar({ label, size = 36 }: { label: string; size?: number }) {
  const initials = label
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(0,0,0,0.08)",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text style={{ fontWeight: "800" }}>{initials}</Text>
    </View>
  );
}
