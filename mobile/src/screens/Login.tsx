import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking
} from "react-native";
import * as Haptics from "expo-haptics";
import { getSupabase } from "../lib/supabase";
import { Theme } from "../theme";

type Action = "signin" | "signup" | "magic" | null;

export function AuthScreen({ navigation }: any) {
  const supabase = getSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailValue = useMemo(() => email.trim().toLowerCase(), [email]);
  const passwordValue = useMemo(() => password.trim(), [password]);

  const resetState = () => {
    setError(null);
    setInfo(null);
  };

  const handleSignIn = async () => {
    resetState();
    if (!emailValue || !passwordValue) {
      setError("Enter email and password.");
      return;
    }
    setLoading("signin");
    await Haptics.selectionAsync();
    const { error } = await supabase.auth.signInWithPassword({ email: emailValue, password: passwordValue });
    if (error) setError(error.message ?? "Unable to sign in.");
    else setInfo("Signed in.");
    setLoading(null);
  };

  const handleSignUp = async () => {
    resetState();
    if (!emailValue || !passwordValue) {
      setError("Enter email and password.");
      return;
    }
    setLoading("signup");
    await Haptics.selectionAsync();
    const { data, error } = await supabase.auth.signUp({ email: emailValue, password: passwordValue });
    if (error) setError(error.message ?? "Unable to create account.");
    else if (data.session) setInfo("Account created. Signed in.");
    else setInfo("Check your email to confirm.");
    setLoading(null);
  };

  const handleMagic = async () => {
    resetState();
    if (!emailValue) {
      setError("Enter your email.");
      return;
    }
    setLoading("magic");
    await Haptics.selectionAsync();
    const { error } = await supabase.auth.signInWithOtp({ email: emailValue });
    if (error) setError(error.message ?? "Unable to send magic link.");
    else setInfo("Check your email for the magic link.");
    setLoading(null);
  };

  const renderButton = (
    label: string,
    action: Action,
    onPress: () => void,
    options?: { kind?: "primary" | "secondary"; disabled?: boolean }
  ) => {
    const isActive = loading === action;
    const kind = options?.kind ?? "primary";
    const disabled = isActive || options?.disabled;
    const baseStyle = {
      height: 48,
      borderRadius: Theme.radius.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: Theme.spacing.sm
    };
    const colorStyle =
      kind === "primary"
        ? { backgroundColor: Theme.colors.primaryBlue2 }
        : { borderWidth: 1, borderColor: Theme.colors.border, backgroundColor: "white" };

    return (
      <Pressable onPress={onPress} disabled={disabled} style={[baseStyle, colorStyle, disabled && { opacity: 0.6 }]}
      >
        {isActive ? (
          <ActivityIndicator color={kind === "primary" ? "white" : Theme.colors.text} />
        ) : (
          <Text
            style={{
              color: kind === "primary" ? "white" : Theme.colors.text,
              fontWeight: "800"
            }}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Theme.colors.primaryBlue }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -80,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: 200,
          backgroundColor: "rgba(30,58,138,0.35)"
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 40,
          left: -60,
          width: 180,
          height: 180,
          borderRadius: 160,
          backgroundColor: "rgba(11,27,58,0.45)"
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 72,
          paddingHorizontal: Theme.spacing.lg,
          paddingBottom: 48
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            borderRadius: Theme.radius.xl,
            padding: Theme.spacing.lg,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.14)",
            elevation: 3
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: Theme.colors.primaryBlue,
                alignItems: "center",
                justifyContent: "center",
                marginRight: Theme.spacing.md
              }}
            >
              <Image
                source={require("../../assets/icon.png")}
                style={{ width: 42, height: 42, borderRadius: 12 }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Theme.colors.text, fontSize: 20, fontWeight: "900" }}>
                Sign in to the control panel
              </Text>
              <Text style={{ marginTop: 6, color: Theme.colors.textMuted }}>
                Access spaces, chat, threads, and tools.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: Theme.spacing.lg }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="rgba(12,15,20,0.4)"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                height: 48,
                borderWidth: 1,
                borderColor: Theme.colors.border,
                borderRadius: Theme.radius.md,
                paddingHorizontal: 14,
                backgroundColor: "white",
                color: Theme.colors.text
              }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="rgba(12,15,20,0.4)"
              secureTextEntry
              style={{
                height: 48,
                borderWidth: 1,
                borderColor: Theme.colors.border,
                borderRadius: Theme.radius.md,
                paddingHorizontal: 14,
                backgroundColor: "white",
                color: Theme.colors.text,
                marginTop: Theme.spacing.sm
              }}
            />

            {error ? (
              <Text style={{ color: Theme.colors.danger, marginTop: Theme.spacing.xs, fontWeight: "700" }}>
                {error}
              </Text>
            ) : null}
            {info ? (
              <Text style={{ color: Theme.colors.primaryBlue2, marginTop: Theme.spacing.xs, fontWeight: "700" }}>
                {info}
              </Text>
            ) : null}

            {renderButton("Sign in", "signin", handleSignIn, { kind: "primary" })}
            {renderButton("Create account", "signup", handleSignUp, { kind: "secondary" })}
          </View>

          <View
            style={{
              marginTop: Theme.spacing.lg,
              borderTopWidth: 1,
              borderTopColor: Theme.colors.border,
              paddingTop: Theme.spacing.lg
            }}
          >
            <Text style={{ color: Theme.colors.text, fontWeight: "800", marginBottom: Theme.spacing.sm }}>
              Other options
            </Text>
            {renderButton("Continue with Magic (Email)", "magic", handleMagic, { kind: "secondary" })}

            <View style={{ marginTop: Theme.spacing.sm }}>
              {["Sign in with Solana (Phantom)", "Sign in with Ethereum (MetaMask)", "Connect Wallet (Magic)"].map(
                (label) => (
                  <Pressable
                    key={label}
                    disabled
                    style={{
                      height: 44,
                      borderRadius: Theme.radius.md,
                      borderWidth: 1,
                      borderColor: Theme.colors.border,
                      backgroundColor: Theme.colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: Theme.spacing.xs,
                      opacity: 0.4
                    }}
                  >
                    <Text style={{ color: Theme.colors.textMuted, fontWeight: "700" }}>{label}</Text>
                  </Pressable>
                )
              )}
            </View>
          </View>

          <Pressable
            onPress={() => Linking.openURL("mailto:support@ba6.app").catch(() => {})}
            style={{ marginTop: Theme.spacing.lg, alignItems: "center" }}
          >
            <Text style={{ color: Theme.colors.textMuted, fontWeight: "700" }}>
              Need help? Contact support
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

export function Login(props: any) {
  return <AuthScreen {...props} />;
}
