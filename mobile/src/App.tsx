import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { RootNavigator } from "./navigation/RootNavigator";
import { AppStateProvider } from "./state/AppState";

export default function App() {
  return (
    <AppStateProvider>
      <RootNavigator />
      <StatusBar style="dark" />
    </AppStateProvider>
  );
}
