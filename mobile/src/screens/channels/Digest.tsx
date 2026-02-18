import React from "react";
import { View, Text } from "react-native";
import { TownsBA6Theme as T } from "../../ui/towns/theme";

export function Digest({ spaceId }: { spaceId: string; navigation: any }) {
  return (
    <View style={{ flex: 1, padding: T.space.s16, backgroundColor: T.colors.bg }}>
      <Text style={{ fontSize: 16, fontWeight: "900", color: T.colors.text }}>Digest</Text>
      <Text style={{ marginTop: 6, color: T.colors.textMuted }}>
        Read-only curated feed for the space ({spaceId}).
      </Text>
    </View>
  );
}
