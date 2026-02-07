import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { TownsBA6Theme as T } from "./theme";

type BubbleProps = {
  mine: boolean;
  name: string;
  body: string;
  ts?: string;
  showName?: boolean;
  showTimestamp?: boolean;
  compact?: boolean;
};

export function MessageBubble({
  mine,
  name,
  body,
  ts,
  showName = true,
  showTimestamp = true,
  compact = false
}: BubbleProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true
    }).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  return (
    <Animated.View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "86%",
        marginBottom: compact ? T.space.s8 : T.space.s14,
        opacity: anim,
        transform: [{ translateY }]
      }}
    >
      <View
        style={{
          backgroundColor: mine ? T.colors.bubbleMine : T.colors.bubbleOther,
          borderRadius: T.radii.bubble,
          paddingHorizontal: T.space.s14,
          paddingVertical: T.space.s12,
          shadowColor: T.colors.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 1
        }}
      >
        {showName ? (
          <Text style={{ color: T.colors.textMuted, fontSize: 12, fontWeight: "800" }}>
            {name}
          </Text>
        ) : null}
        <Text
          style={{
            marginTop: showName ? 6 : 0,
            color: T.colors.text,
            fontSize: 15,
            fontWeight: "600",
            lineHeight: 20
          }}
        >
          {body}
        </Text>
        {showTimestamp && ts ? (
          <Text
            style={{
              marginTop: 8,
              color: T.colors.textMuted,
              fontSize: 11,
              fontWeight: "700",
              alignSelf: "flex-end"
            }}
          >
            {ts}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}
