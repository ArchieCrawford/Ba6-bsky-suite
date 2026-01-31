import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Theme } from "../theme";

const demo = [
  { did: "did:ba6:owner", title: "@owner", role: "Owner" },
  { did: "did:ba6:admin", title: "@admin", role: "Admin" },
  { did: "did:ba6:member", title: "did:ba6:member", role: "Member" }
];

export function Members({ navigation, route }: any) {
  const spaceId = route?.params?.spaceId as string;

  return (
    <View style={{ flex: 1, backgroundColor: Theme.colors.surface }}>
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: Theme.spacing.lg,
          paddingBottom: Theme.spacing.md,
          backgroundColor: Theme.colors.primaryBlue
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900", color: "white" }}>Members</Text>
        <Text style={{ marginTop: 2, color: "rgba(255,255,255,0.7)" }} numberOfLines={1}>
          {spaceId}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: Theme.spacing.lg, paddingBottom: Theme.spacing.xl }}>
        {demo.map((m) => (
          <Pressable
            key={m.did}
            onPress={() => navigation.navigate("DMThread", { did: m.did, title: m.title })}
            style={{
              borderWidth: 1,
              borderColor: Theme.colors.border,
              padding: Theme.spacing.md,
              borderRadius: Theme.radius.lg,
              marginBottom: Theme.spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: "white"
            }}
          >
            <Avatar label={m.title} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: Theme.colors.text }}>{m.title}</Text>
              <Text style={{ marginTop: 6, color: Theme.colors.textMuted }}>
                {m.role} - {m.did}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
