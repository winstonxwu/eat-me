import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import ProfileDetailsScreen from '../screens/ProfileDetailsScreen';
import ForYouScreen from '../screens/ForYouScreen';
import LocationScreen from '../screens/LocationScreen';
import MatchesScreen from '../screens/MatchesScreen';

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
        <Stack.Screen name="LocationScreen" component={LocationScreen} />
        <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
        <Stack.Screen name="ForYouScreen" component={ForYouScreen} />
        <Stack.Screen name="MatchesScreen" component={MatchesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
