import React from "react";
import { View, Text, Pressable } from "react-native";
import { Avatar } from "../ui/Avatar";

const demo = [
  { did: "did:ba6:owner", title: "@owner", last: "Welcome.", unread: 1 },
  { did: "did:ba6:admin", title: "@admin", last: "Ping.", unread: 0 }
];

export function DirectMessages({ navigation }: any) {
  return (
    <View style={{ flex: 1, paddingTop: 54, paddingHorizontal: 14, backgroundColor: "white" }}>
      <Text style={{ fontSize: 18, fontWeight: "900" }}>Direct Messages</Text>
      <View style={{ marginTop: 12 }}>
        {demo.map((d) => (
          <Pressable
            key={d.did}
            onPress={() => navigation.navigate("DMThread", { did: d.did, title: d.title })}
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
            <Avatar label={d.title} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900" }}>{d.title}</Text>
              <Text style={{ marginTop: 6, opacity: 0.7 }}>
                {d.last}
                {d.unread ? ` - ${d.unread} unread` : ""}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
