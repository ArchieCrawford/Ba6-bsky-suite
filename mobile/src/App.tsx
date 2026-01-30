import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootNavigator } from "./navigation/RootNavigator";
import { AppStateProvider } from "./state/AppState";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </AppStateProvider>
    </GestureHandlerRootView>
  );
}
