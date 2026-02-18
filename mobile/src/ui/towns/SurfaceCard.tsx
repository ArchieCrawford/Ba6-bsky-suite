import React from "react";
import { View, ViewStyle } from "react-native";
import { TownsBA6Theme as T } from "./theme";

type SurfaceCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
};

export function SurfaceCard({ children, style, padding = T.space.s14 }: SurfaceCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: T.colors.layer1,
          borderRadius: T.radii.card,
          padding,
          shadowColor: T.colors.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 1
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
