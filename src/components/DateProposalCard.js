import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { scheduleCustomNotification } from '../utils/notifications';

export default function DateProposalCard({ proposal, onUpdate, partnerName }) {
  const [loading, setLoading] = useState(false);
  const [animation] = useState(new Animated.Value(1));

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };

  const getMealEmoji = (dateString) => {
    const hour = new Date(dateString).getHours();
    if (hour < 11) return '🥞';
    if (hour < 15) return '🍕';
    if (hour < 18) return '☕';
    return '🍷';
  };

  const getPriceString = (level) => {
    return '$'.repeat(level || 1);
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      // Update proposal status to accepted
      const { error } = await supabase
        .from('food_date_proposals')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', proposal.id);

      if (error) throw error;

      // Send confirmation notification to proposer
      await scheduleCustomNotification({
        title: '🎉 Date Accepted!',
        body: `${partnerName} accepted your dinner invitation! It's going to be amazing! 💕`,
        data: {
          type: 'food_date_accepted',
          proposalId: proposal.id,
          matchId: proposal.match_id,
        },
      });

      // Animate card out
      Animated.timing(animation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        Alert.alert(
          '🎉 Date Confirmed!',
          `Great! You have a date at ${proposal.restaurant_name} on ${formatDateTime(proposal.proposed_datetime).date}!`,
          [{ text: 'Awesome!', onPress: () => onUpdate?.(proposal.id, 'accepted') }]
        );
      });
    } catch (error) {
      console.error('Accept proposal error:', error);
      Alert.alert('Error', 'Failed to accept date invitation');
      setLoading(false);
    }
  };

  const handleReject = async () => {
    Alert.alert(
      'Decline Date?',
      'Are you sure you want to decline this date invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('food_date_proposals')
                .update({
                  status: 'rejected',
                  responded_at: new Date().toISOString(),
                })
                .eq('id', proposal.id);

              if (error) throw error;

              // Send gentle notification to proposer
              await scheduleCustomNotification({
                title: '💔 Date Declined',
                body: `${partnerName} isn't available for that date. Maybe suggest something else? 💭`,
                data: {
                  type: 'food_date_declined',
                  proposalId: proposal.id,
                  matchId: proposal.match_id,
                },
              });

              Animated.timing(animation, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start(() => {
                onUpdate?.(proposal.id, 'rejected');
              });
            } catch (error) {
              console.error('Reject proposal error:', error);
              Alert.alert('Error', 'Failed to decline date invitation');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRenegotiate = () => {
    // Navigate to renegotiation screen (to be implemented)
    Alert.alert(
      '📝 Suggest Changes',
      'This feature is coming soon! For now, you can chat with them about alternative times or places.',
      [{ text: 'OK' }]
    );
  };

  const { date, time } = formatDateTime(proposal.proposed_datetime);
  const mealEmoji = getMealEmoji(proposal.proposed_datetime);

  return (
    <Animated.View style={[styles.container, { opacity: animation, transform: [{ scale: animation }] }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>🍽️ {partnerName} invited you to dinner!</Text>
          <Text style={styles.timestamp}>
            {new Date(proposal.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName}>{proposal.restaurant_name}</Text>
            <Text style={styles.cuisine}>{proposal.restaurant_cuisine}</Text>
            <View style={styles.meta}>
              <Text style={styles.rating}>⭐ {proposal.restaurant_rating}</Text>
              <Text style={styles.price}>{getPriceString(proposal.restaurant_price_level)}</Text>
            </View>
            <Text style={styles.address}>📍 {proposal.restaurant_address}</Text>
          </View>

          <View style={styles.dateTimeInfo}>
            <Text style={styles.dateTime}>
              {mealEmoji} {date}
            </Text>
            <Text style={styles.time}>{time}</Text>
          </View>

          {proposal.message && (
            <View style={styles.messageContainer}>
              <Text style={styles.messageLabel}>💌 Message:</Text>
              <Text style={styles.message}>"{proposal.message}"</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={loading}
          >
            <Ionicons name="close-circle" size={20} color="white" />
            <Text style={styles.rejectButtonText}>😅 Maybe Next Time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.renegotiateButton]}
            onPress={handleRenegotiate}
            disabled={loading}
          >
            <Ionicons name="create-outline" size={20} color="#FF9800" />
            <Text style={styles.renegotiateButtonText}>📝 Suggest Changes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton, loading && styles.disabledButton]}
            onPress={handleAccept}
            disabled={loading}
          >
            <Ionicons name="heart" size={20} color="white" />
            <Text style={styles.acceptButtonText}>
              {loading ? 'Accepting...' : '😍 Accept'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#FFB6C1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  content: {
    marginBottom: 20,
  },
  restaurantInfo: {
    marginBottom: 15,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cuisine: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rating: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  price: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  address: {
    fontSize: 12,
    color: '#999',
  },
  dateTimeInfo: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  dateTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  time: {
    fontSize: 14,
    color: '#666',
  },
  messageContainer: {
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 15,
  },
  messageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  rejectButton: {
    backgroundColor: '#FF5722',
  },
  rejectButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  renegotiateButton: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  renegotiateButtonText: {
    color: '#FF9800',
    fontWeight: 'bold',
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
});