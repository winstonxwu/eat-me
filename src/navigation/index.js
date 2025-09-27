import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import ProfileDetailsScreen from '../screens/ProfileDetailsScreen';
import LocationScreen from '../screens/LocationScreen';
import SuggestionsScreen from '../screens/SuggestionsScreen';
import ChatScreen from '../screens/ChatScreen';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

export default function RootNav() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
        <Stack.Screen name="LocationScreen" component={LocationScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="SuggestionsScreen" component={SuggestionsScreen} />
        <Stack.Screen name="ChatScreen" component={ChatScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
