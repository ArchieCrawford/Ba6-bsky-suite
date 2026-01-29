import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const sendLink = async () => {
    if (!email.trim()) return;
    await Haptics.selectionAsync();
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (!error) setSent(true);
  };

  return (
    <View style={{ flex: 1, paddingTop: 54, paddingHorizontal: 14, backgroundColor: "white" }}>
      <Text style={{ fontSize: 18, fontWeight: "900" }}>Sign in</Text>
      <Text style={{ marginTop: 8, opacity: 0.7 }}>Magic link via Supabase auth.</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          marginTop: 14,
          height: 44,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.12)",
          borderRadius: 14,
          paddingHorizontal: 12
        }}
      />

      <Pressable
        onPress={sendLink}
        style={{
          marginTop: 14,
          height: 44,
          borderRadius: 14,
          backgroundColor: "rgba(0,0,0,0.85)",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={{ color: "white", fontWeight: "900" }}>{sent ? "Link sent" : "Send magic link"}</Text>
      </Pressable>
    </View>
  );
}
