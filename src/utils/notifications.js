import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Request notification permissions
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFB6C1',
      sound: 'default',
    });
  }

  if (Platform.OS !== 'web') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push token:', token);
    } catch (error) {
      console.log('Error getting push token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Schedule local notification for new match
export async function scheduleMatchNotification(matchData) {
  const { partnerName } = matchData;

  const notificationContent = {
    title: "🍽️ Food Match!",
    body: `${partnerName} likes your taste in food! 🍽️`,
    data: {
      type: 'match',
      matchId: matchData.matchId,
      partnerName: partnerName
    },
    sound: 'default',
    priority: 'high',
  };

  // Add food-focused messages
  const foodMessages = [
    `${partnerName} likes your taste in food! 🍽️`,
    `${partnerName} thinks you have great food taste! Ready to explore together? 🌟`,
    `Food buddy alert! ${partnerName} wants to try new places with you 💫`,
    `Yum! ${partnerName} matches your food vibe! Let's eat! 🎉`
  ];

  notificationContent.body = foodMessages[Math.floor(Math.random() * foodMessages.length)];

  try {
    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: { seconds: 1 },
    });
    console.log('Match notification scheduled');
  } catch (error) {
    console.log('Error scheduling match notification:', error);
  }
}

// Schedule local notification for new chat message
export async function scheduleChatNotification(messageData) {
  const { senderName, message, matchId } = messageData;

  // Truncate long messages
  let displayMessage = message;
  if (message.length > 50) {
    displayMessage = message.substring(0, 47) + '...';
  }

  const notificationContent = {
    title: `💬 ${senderName}`,
    body: displayMessage,
    data: {
      type: 'message',
      matchId: matchId,
      senderName: senderName
    },
    sound: 'default',
    priority: 'high',
  };

  // Add food-themed emojis for variety
  const foodEmojis = ['🍕', '🍔', '🍜', '🍰', '🥗', '🍱', '🌮', '🍣'];
  const randomEmoji = foodEmojis[Math.floor(Math.random() * foodEmojis.length)];

  notificationContent.title = `${randomEmoji} ${senderName}`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: { seconds: 1 },
    });
    console.log('Chat notification scheduled');
  } catch (error) {
    console.log('Error scheduling chat notification:', error);
  }
}

// Handle notification tap - navigate to appropriate screen
export function handleNotificationResponse(response, navigation) {
  const data = response.notification.request.content.data;

  if (data.type === 'match') {
    // Navigate to matches screen
    navigation.navigate('Matches');
  } else if (data.type === 'message') {
    // Navigate to specific chat
    navigation.navigate('ChatScreen', {
      matchId: data.matchId,
      partnerName: data.senderName
    });
  }
}

// Schedule custom notification (for food date invites, etc.)
export async function scheduleCustomNotification({ title, body, data }) {
  const notificationContent = {
    title: title,
    body: body,
    data: data || {},
    sound: 'default',
    priority: 'high',
  };

  // Add food emoji variety for food date notifications
  if (data?.type === 'food_date_proposal') {
    const foodEmojis = ['🍽️', '🍕', '🍔', '🍜', '🍰', '🥗', '🍱', '🌮', '🍣'];
    const randomEmoji = foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
    notificationContent.title = `${randomEmoji} ${title.replace(/🍽️|🍕|🍔|🍜|🍰|🥗|🍱|🌮|🍣/g, '')}`;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: { seconds: 1 },
    });
    console.log('Custom notification scheduled');
  } catch (error) {
    console.log('Error scheduling custom notification:', error);
  }
}

// Cancel all scheduled notifications
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All notifications cancelled');
  } catch (error) {
    console.log('Error cancelling notifications:', error);
  }
}