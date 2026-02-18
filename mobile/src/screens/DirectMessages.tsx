import React from "react";
import { View, Text, Pressable } from "react-native";
import { Avatar } from "../ui/Avatar";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { ScreenHeader } from "../ui/towns/ScreenHeader";

const demo = [
  { did: "did:ba6:owner", title: "@owner", last: "Welcome.", unread: 1 },
  { did: "did:ba6:admin", title: "@admin", last: "Ping.", unread: 0 }
];

export function DirectMessages({ navigation }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <ScreenHeader title="Direct Messages" subtitle="Private conversations powered by DIDs." />

      <View style={{ marginTop: 12, paddingHorizontal: T.space.s16 }}>
        {demo.map((d) => (
          <Pressable
            key={d.did}
            onPress={() => navigation.navigate("DMThread", { did: d.did, title: d.title })}
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
            <Avatar label={d.title} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: T.colors.text }}>{d.title}</Text>
              <Text style={{ marginTop: 6, color: T.colors.textMuted }} numberOfLines={1}>
                {d.last}
              </Text>
            </View>
            {d.unread ? (
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  paddingHorizontal: 5,
                  backgroundColor: T.colors.yellow,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: T.colors.text, fontSize: 10, fontWeight: "800" }}>{d.unread}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
