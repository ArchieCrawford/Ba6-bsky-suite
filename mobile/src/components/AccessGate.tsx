import React from "react";
import { View, Text, Pressable } from "react-native";
import { Theme } from "../theme";

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
        borderWidth: 1,
        borderColor: Theme.colors.border,
        backgroundColor: Theme.colors.surface,
        padding: Theme.spacing.lg,
        borderRadius: Theme.radius.lg
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: Theme.colors.text }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ marginTop: 6, color: Theme.colors.textMuted }}>
          {subtitle}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        style={{
          marginTop: Theme.spacing.md,
          height: 44,
          borderRadius: Theme.radius.md,
          backgroundColor: Theme.colors.primaryBlue2,
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
            marginTop: Theme.spacing.sm,
            height: 40,
            borderRadius: Theme.radius.md,
            borderWidth: 1,
            borderColor: Theme.colors.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white"
          }}
        >
          <Text style={{ color: Theme.colors.text, fontWeight: "700" }}>
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
