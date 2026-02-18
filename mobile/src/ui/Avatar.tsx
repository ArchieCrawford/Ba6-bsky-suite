import React from "react";
import { View, Text } from "react-native";
import { TownsBA6Theme as T } from "./towns/theme";

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
        backgroundColor: T.colors.layer2,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: T.colors.shadow,
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1
      }}
    >
      <Text style={{ fontWeight: "800", color: T.colors.text }}>{initials}</Text>
    </View>
  );
}
