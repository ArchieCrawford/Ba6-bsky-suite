import React from "react";
import { View, Text } from "react-native";

export function Digest({ spaceId }: { spaceId: string; navigation: any }) {
  return (
    <View style={{ flex: 1, padding: 14, backgroundColor: "white" }}>
      <Text style={{ fontSize: 16, fontWeight: "900" }}>Digest</Text>
      <Text style={{ marginTop: 6, opacity: 0.7 }}>
        Read-only curated feed for the space ({spaceId}). Hook to real digest pipeline later.
      </Text>
    </View>
  );
}
