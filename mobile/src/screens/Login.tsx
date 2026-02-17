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
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { SurfaceCard } from "../ui/towns/SurfaceCard";

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
      borderRadius: T.radii.pill,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: T.space.s10
    };
    const colorStyle =
      kind === "primary"
        ? { backgroundColor: T.colors.blue1 }
        : { backgroundColor: T.colors.layer2 };

    return (
      <Pressable onPress={onPress} disabled={disabled} style={[baseStyle, colorStyle, disabled && { opacity: 0.6 }]}>
        {isActive ? (
          <ActivityIndicator color={kind === "primary" ? "white" : T.colors.text} />
        ) : (
          <Text
            style={{
              color: kind === "primary" ? "white" : T.colors.text,
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
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -80,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: 200,
          backgroundColor: "rgba(11,60,255,0.12)"
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
          backgroundColor: "rgba(10,30,106,0.12)"
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 72,
          paddingHorizontal: T.space.s16,
          paddingBottom: 48
        }}
      >
        <SurfaceCard padding={T.space.s16}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: T.colors.blue3,
                alignItems: "center",
                justifyContent: "center",
                marginRight: T.space.s12
              }}
            >
              <Image
                source={require("../../assets/icon.png")}
                style={{ width: 42, height: 42, borderRadius: 12 }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.colors.text, fontSize: 20, fontWeight: "900" }}>
                Sign in to BA6
              </Text>
              <Text style={{ marginTop: 6, color: T.colors.textMuted }}>
                Access groups, chat, and tools.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: T.space.s16 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={T.colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                height: 48,
                borderRadius: T.radii.input,
                paddingHorizontal: 14,
                backgroundColor: T.colors.layer2,
                color: T.colors.text
              }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={T.colors.textMuted}
              secureTextEntry
              style={{
                height: 48,
                borderRadius: T.radii.input,
                paddingHorizontal: 14,
                backgroundColor: T.colors.layer2,
                color: T.colors.text,
                marginTop: T.space.s10
              }}
            />

            {error ? (
              <Text style={{ color: "#E14B4B", marginTop: T.space.s8, fontWeight: "700" }}>
                {error}
              </Text>
            ) : null}
            {info ? (
              <Text style={{ color: T.colors.blue1, marginTop: T.space.s8, fontWeight: "700" }}>
                {info}
              </Text>
            ) : null}

            {renderButton("Sign in", "signin", handleSignIn, { kind: "primary" })}
            {renderButton("Create account", "signup", handleSignUp, { kind: "secondary" })}
          </View>

          <View style={{ marginTop: T.space.s16 }}>
            <Text style={{ color: T.colors.text, fontWeight: "800", marginBottom: T.space.s10 }}>
              Other options
            </Text>
            {renderButton("Continue with Magic (Email)", "magic", handleMagic, { kind: "secondary" })}

            <View style={{ marginTop: T.space.s10 }}>
              {["Sign in with Solana (Phantom)", "Sign in with Ethereum (MetaMask)", "Connect Wallet (Magic)"].map(
                (label) => (
                  <Pressable
                    key={label}
                    disabled
                    style={{
                      height: 44,
                      borderRadius: T.radii.input,
                      backgroundColor: T.colors.layer2,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: T.space.s6,
                      opacity: 0.5
                    }}
                  >
                    <Text style={{ color: T.colors.textMuted, fontWeight: "700" }}>{label}</Text>
                  </Pressable>
                )
              )}
            </View>
          </View>

          <Pressable
            onPress={() => Linking.openURL("mailto:support@ba6.app").catch(() => {})}
            style={{ marginTop: T.space.s16, alignItems: "center" }}
          >
            <Text style={{ color: T.colors.textMuted, fontWeight: "700" }}>
              Need help? Contact support
            </Text>
          </Pressable>
        </SurfaceCard>
      </ScrollView>
    </View>
  );
}

export function Login(props: any) {
  return <AuthScreen {...props} />;
}
