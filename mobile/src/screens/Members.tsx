import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Avatar } from "../ui/Avatar";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { ScreenHeader } from "../ui/towns/ScreenHeader";

const demo = [
  { did: "did:ba6:owner", title: "@owner", role: "Owner" },
  { did: "did:ba6:admin", title: "@admin", role: "Admin" },
  { did: "did:ba6:member", title: "did:ba6:member", role: "Member" }
];

export function Members({ navigation, route }: any) {
  const spaceId = route?.params?.spaceId as string;

  return (
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <ScreenHeader title="Members" subtitle={spaceId} onPressBack={() => navigation.goBack?.()} backLabel="Back" />

      <ScrollView contentContainerStyle={{ padding: T.space.s16, paddingBottom: T.space.s24 }}>
        {demo.map((m) => (
          <Pressable
            key={m.did}
            onPress={() => navigation.navigate("DMThread", { did: m.did, title: m.title })}
            style={{
              padding: T.space.s14,
              borderRadius: T.radii.card,
              marginBottom: T.space.s12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: T.colors.layer1,
              shadowColor: T.colors.shadow,
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 1
            }}
          >
            <Avatar label={m.title} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: T.colors.text }}>{m.title}</Text>
              <Text style={{ marginTop: 6, color: T.colors.textMuted }}>
                {m.role} - {m.did}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
