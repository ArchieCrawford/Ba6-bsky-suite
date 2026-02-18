import React from "react";
import { View, Text, Pressable } from "react-native";
import { TownsBA6Theme as T } from "../ui/towns/theme";

export function AccessGate({
  title,
  subtitle,
  ctaLabel,
  onPress,
  secondaryLabel,
  onSecondary
}: {
  title: string;
  subtitle?: string;
  ctaLabel: string;
  onPress: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: T.colors.layer1,
        padding: T.space.s16,
        borderRadius: T.radii.card,
        shadowColor: T.colors.shadow,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 1
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: T.colors.text }}>{title}</Text>
      {subtitle ? (
        <Text style={{ marginTop: 6, color: T.colors.textMuted }}>{subtitle}</Text>
      ) : null}
      <Pressable
        onPress={onPress}
        style={{
          marginTop: T.space.s12,
          height: 44,
          borderRadius: T.radii.pill,
          backgroundColor: T.colors.blue1,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>{ctaLabel}</Text>
      </Pressable>
      {secondaryLabel && onSecondary ? (
        <Pressable
          onPress={onSecondary}
          style={{
            marginTop: T.space.s10,
            height: 40,
            borderRadius: T.radii.pill,
            backgroundColor: T.colors.layer2,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: T.colors.text, fontWeight: "700" }}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
