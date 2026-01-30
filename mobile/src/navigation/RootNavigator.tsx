import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createStackNavigator } from "@react-navigation/stack";
import { SpaceSwitcherDrawer } from "./SpaceSwitcherDrawer";
import { SpacesHome } from "../screens/SpacesHome";
import { SpaceView } from "../screens/SpaceView";
import { Members } from "../screens/Members";
import { DirectMessages } from "../screens/DirectMessages";
import { DMThread } from "../screens/DMThread";
import { Wallets } from "../screens/Wallets";
import { Login } from "../screens/Login";
import { useAppState } from "../state/AppState";

export type RootStackParamList = {
  SpacesHome: undefined;
  SpaceView: { spaceId?: string } | undefined;
  Members: { spaceId: string };
  DirectMessages: undefined;
  DMThread: { did: string; title?: string };
  Wallets: undefined;
  Login: undefined;
};

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator<RootStackParamList>();

function MainStack() {
  const { hasSession } = useAppState();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SpacesHome" component={SpacesHome} />
      <Stack.Screen name="SpaceView" component={SpaceView} />
      <Stack.Screen name="Members" component={Members} />
      <Stack.Screen name="DirectMessages" component={DirectMessages} />
      <Stack.Screen name="DMThread" component={DMThread} />
      <Stack.Screen name="Wallets" component={Wallets} />
      {!hasSession ? <Stack.Screen name="Login" component={Login} /> : null}
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Drawer.Navigator
        useLegacyImplementation={false}
        screenOptions={{
          headerShown: false,
          drawerType: "front",
          overlayColor: "rgba(0,0,0,0.28)",
          drawerStyle: { width: 92 }
        }}
        drawerContent={(props) => <SpaceSwitcherDrawer {...props} />}
      >
        <Drawer.Screen name="Main" component={MainStack} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}
