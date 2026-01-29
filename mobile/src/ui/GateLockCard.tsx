import React from "react";
import { View, Text, Pressable } from "react-native";

export function GateLockCard({
  title,
  subtitle,
  cta,
  onPress
}: {
  title: string;
  subtitle?: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.12)",
        backgroundColor: "rgba(0,0,0,0.03)",
        padding: 14,
        borderRadius: 16
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "800" }}>{title}</Text>
      {subtitle ? <Text style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{subtitle}</Text> : null}
      <Pressable
        onPress={onPress}
        style={{
          marginTop: 12,
          height: 40,
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.82)",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>{cta}</Text>
      </Pressable>
    </View>
  );
}
