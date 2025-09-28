import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import { setupMessageNotifications, cleanupMessageNotifications } from './src/utils/messaging';
import RootNav from './src/navigation';

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();
  const messageSubscription = useRef();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync();

    // Delay notification setup to allow user to authenticate first
    const setupNotifications = async () => {
      // Wait a bit for auth to complete
      setTimeout(async () => {
        try {
          const subscription = await setupMessageNotifications();
          messageSubscription.current = subscription;
          console.log('Message notifications setup complete');
        } catch (error) {
          console.log('Message notifications setup will retry when user logs in:', error.message);
          // This is expected if user isn't logged in yet
        }
      }, 2000); // Wait 2 seconds for potential auth
    };

    setupNotifications();

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listen for user tapping on notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
      cleanupMessageNotifications(messageSubscription.current);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootNav />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
