import React from "react";
import { View, Text } from "react-native";

export function Wallets() {
  return (
    <View style={{ flex: 1, paddingTop: 54, paddingHorizontal: 14, backgroundColor: "white" }}>
      <Text style={{ fontSize: 18, fontWeight: "900" }}>Wallets</Text>
      <Text style={{ marginTop: 8, opacity: 0.7 }}>
        This screen handles wallet_required and payment_required flows.
      </Text>
    </View>
  );
}
