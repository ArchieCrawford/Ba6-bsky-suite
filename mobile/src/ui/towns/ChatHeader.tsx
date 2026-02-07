import React from "react";
import { View, Text, Pressable } from "react-native";
import { TownsBA6Theme as T } from "./theme";

type HeaderProps = {
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusTone?: "live" | "muted";
  onPressTools?: () => void;
};

export function ChatHeader({
  title,
  subtitle,
  statusLabel,
  statusTone = "live",
  onPressTools
}: HeaderProps) {
  const dotColor = statusTone === "muted" ? T.colors.layer2 : T.colors.yellow;

  return (
    <View
      style={{
        paddingHorizontal: T.space.s16,
        paddingTop: T.space.s14,
        paddingBottom: T.space.s12,
        backgroundColor: T.colors.layer1,
        shadowColor: T.colors.shadow,
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: T.colors.text, fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: dotColor,
                marginRight: 6
              }}
            />
            <Text style={{ color: T.colors.textMuted, fontSize: 12, fontWeight: "600" }}>
              {statusLabel ?? "Live"}
            </Text>
            {subtitle ? (
              <Text style={{ color: T.colors.textMuted, fontSize: 12, fontWeight: "600", marginLeft: 6 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={onPressTools}
          style={{
            width: 38,
            height: 38,
            borderRadius: 14,
            backgroundColor: T.colors.layer2,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: T.colors.shadow,
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1
          }}
          hitSlop={10}
        >
          <View style={{ flexDirection: "row", width: 16, justifyContent: "space-between" }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: T.colors.text }} />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: T.colors.text }} />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: T.colors.text }} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}
