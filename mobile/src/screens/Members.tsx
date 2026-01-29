import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Avatar } from "../ui/Avatar";

const demo = [
  { did: "did:ba6:owner", title: "@owner", role: "Owner" },
  { did: "did:ba6:admin", title: "@admin", role: "Admin" },
  { did: "did:ba6:member", title: "did:ba6:member", role: "Member" }
];

export function Members({ navigation, route }: any) {
  const spaceId = route?.params?.spaceId as string;

  return (
    <View style={{ flex: 1, paddingTop: 54, backgroundColor: "white" }}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.10)"
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900" }}>Members</Text>
        <Text style={{ marginTop: 2, opacity: 0.65 }} numberOfLines={1}>
          {spaceId}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
        {demo.map((m) => (
          <Pressable
            key={m.did}
            onPress={() => navigation.navigate("DMThread", { did: m.did, title: m.title })}
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              padding: 14,
              borderRadius: 16,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12
            }}
          >
            <Avatar label={m.title} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900" }}>{m.title}</Text>
              <Text style={{ marginTop: 6, opacity: 0.7 }}>
                {m.role} - {m.did}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
