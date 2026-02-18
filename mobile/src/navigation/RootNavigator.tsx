import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { GroupsHome } from "../screens/GroupsHome";
import { GroupChat } from "../screens/GroupChat";
import { Login } from "../screens/Login";
import { Settings } from "../screens/Settings";
import { AccessGate } from "../screens/AccessGate";
import { useAppState } from "../state/AppState";

export type RootStackParamList = {
  GroupsHome: undefined;
  GroupChat: { groupId: string; groupName?: string; inviteCode?: string };
  Settings: undefined;
  AccessGate: undefined;
  Login: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

function AuthedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="GroupsHome">
      <Stack.Screen name="GroupsHome" component={GroupsHome} />
      <Stack.Screen name="GroupChat" component={GroupChat} />
      <Stack.Screen name="Settings" component={Settings} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { hasSession } = useAppState();
  return (
    <NavigationContainer>
      {hasSession ? (
        <AuthedStack key="authed" />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }} key="auth">
          <Stack.Screen name="AccessGate" component={AccessGate} />
          <Stack.Screen name="Login" component={Login} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
