import React from "react";
import { View, Text, Pressable } from "react-native";
import { TownsBA6Theme as T } from "./theme";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onPressBack?: () => void;
  backLabel?: string;
  onPressAction?: () => void;
  actionLabel?: string;
};

export function ScreenHeader({
  title,
  subtitle,
  onPressBack,
  backLabel = "Back",
  onPressAction,
  actionLabel
}: ScreenHeaderProps) {
  return (
    <View
      style={{
        paddingHorizontal: T.space.s16,
        paddingTop: T.space.s14,
        paddingBottom: T.space.s12,
        backgroundColor: T.colors.layer1,
        shadowColor: T.colors.shadow,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.colors.text, fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ marginTop: 4, color: T.colors.textMuted, fontSize: 12, fontWeight: "600" }}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {onPressAction && actionLabel ? (
          <Pressable
            onPress={onPressAction}
            style={{
              paddingHorizontal: T.space.s12,
              paddingVertical: T.space.s8,
              borderRadius: T.radii.pill,
              backgroundColor: T.colors.layer2
            }}
            hitSlop={10}
          >
            <Text style={{ color: T.colors.text, fontWeight: "700", fontSize: 12 }}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {onPressBack ? (
        <Pressable onPress={onPressBack} style={{ marginTop: T.space.s10 }} hitSlop={10}>
          <Text style={{ color: T.colors.textMuted, fontWeight: "700", fontSize: 12 }}>{backLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
