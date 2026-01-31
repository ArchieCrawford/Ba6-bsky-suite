import React from "react";
import { View, Text } from "react-native";
import { Theme } from "../../theme";

export function Digest({ spaceId }: { spaceId: string; navigation: any }) {
  return (
    <View style={{ flex: 1, padding: Theme.spacing.md, backgroundColor: "white" }}>
      <Text style={{ fontSize: 16, fontWeight: "900", color: Theme.colors.text }}>Digest</Text>
      <Text style={{ marginTop: 6, color: Theme.colors.textMuted }}>
        Read-only curated feed for the space ({spaceId}).
      </Text>
    </View>
  );
}
