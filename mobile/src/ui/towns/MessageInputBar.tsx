import React from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { TownsBA6Theme as T } from "./theme";

type InputBarProps = {
  value: string;
  onChangeText: (v: string) => void;
  onSend: () => void;
  locked?: boolean;
  lockedText?: string;
  lockedCta?: string;
  onPressCta?: () => void;
  placeholder?: string;
};

function LockIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          top: 1,
          width: 10,
          height: 6,
          borderWidth: 1.5,
          borderColor: color,
          borderBottomWidth: 0,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6
        }}
      />
      <View
        style={{
          width: 12,
          height: 9,
          marginTop: 5,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 3
        }}
      />
    </View>
  );
}

export function MessageInputBar({
  value,
  onChangeText,
  onSend,
  locked,
  lockedText,
  lockedCta,
  onPressCta,
  placeholder
}: InputBarProps) {
  if (locked) {
    return (
      <View
        style={{
          paddingHorizontal: T.space.s16,
          paddingTop: T.space.s12,
          paddingBottom: T.space.s18,
          backgroundColor: T.colors.layer1,
          shadowColor: T.colors.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },
          elevation: 2
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: T.colors.layer2,
            borderRadius: T.radii.input,
            paddingHorizontal: T.space.s12,
            paddingVertical: T.space.s10
          }}
        >
          <LockIcon color={T.colors.textMuted} />
          <Text
            style={{
              flex: 1,
              marginLeft: T.space.s10,
              color: T.colors.text,
              fontWeight: "700"
            }}
          >
            {lockedText ?? "Messaging locked"}
          </Text>
          {lockedCta ? (
            <Pressable
              onPress={onPressCta}
              style={{
                paddingHorizontal: T.space.s12,
                paddingVertical: T.space.s8,
                borderRadius: T.radii.pill,
                backgroundColor: T.colors.blue1
              }}
            >
              <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>{lockedCta}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        paddingHorizontal: T.space.s16,
        paddingTop: T.space.s12,
        paddingBottom: T.space.s18,
        backgroundColor: T.colors.layer1,
        shadowColor: T.colors.shadow,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -2 },
        elevation: 2
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? "Message #chat"}
          placeholderTextColor={T.colors.textMuted}
          style={{
            flex: 1,
            height: 46,
            borderRadius: T.radii.input,
            backgroundColor: T.colors.layer2,
            paddingHorizontal: 14,
            color: T.colors.text,
            fontWeight: "600"
          }}
        />
        <Pressable
          onPress={onSend}
          style={{
            width: 58,
            height: 46,
            borderRadius: T.radii.input,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: T.colors.blue1,
            shadowColor: T.colors.shadow,
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1
          }}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
