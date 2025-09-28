import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Mock restaurant data
const SAMPLE_RESTAURANTS = [
  {
    id: '1',
    name: "Tony's Italian Bistro",
    cuisine: 'Italian 🍝',
    rating: 4.5,
    priceLevel: 2,
    address: '123 Main St',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
  },
  {
    id: '2',
    name: 'Sakura Sushi Bar',
    cuisine: 'Japanese 🍣',
    rating: 4.7,
    priceLevel: 3,
    address: '456 Oak Ave',
    image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=300&fit=crop',
  },
  {
    id: '3',
    name: 'Taco Libre',
    cuisine: 'Mexican 🌮',
    rating: 4.2,
    priceLevel: 1,
    address: '789 Pine St',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
  },
];

export default function FoodDateScreen({ route, navigation }) {
  const { matchId, partnerName, partnerId } = route.params;

  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [selectedTime, setSelectedTime] = useState(new Date(Date.now() + 19 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessage(`Hey ${partnerName}! Want to try this place together? 😊`);
  }, [partnerName]);

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event, time) => {
    setShowTimePicker(false);
    if (time) {
      setSelectedTime(time);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (time) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getMealTime = (time) => {
    const hour = time.getHours();
    if (hour < 11) return { emoji: '🥞', name: 'Breakfast' };
    if (hour < 15) return { emoji: '🍕', name: 'Lunch' };
    if (hour < 18) return { emoji: '☕', name: 'Coffee' };
    return { emoji: '🍷', name: 'Dinner' };
  };

  const getPriceString = (level) => {
    return '$'.repeat(level);
  };

  const sendFoodDateProposal = async () => {
    console.log('Send button pressed - SIMPLE VERSION');

    if (!selectedRestaurant) {
      Alert.alert('Select Restaurant', 'Please choose a restaurant first!');
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        '🎉 Date Invitation Sent!',
        `Your invitation to ${selectedRestaurant.name} has been sent to ${partnerName}!\n\nNote: This is a demo version. Run the SQL setup script in Supabase to enable full functionality.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }, 1500);
  };

  const RestaurantCard = ({ restaurant, selected, onPress }) => (
    <TouchableOpacity
      style={[styles.restaurantCard, selected && styles.selectedCard]}
      onPress={onPress}
    >
      <Image source={{ uri: restaurant.image }} style={styles.restaurantImage} />
      <View style={styles.restaurantInfo}>
        <Text style={styles.restaurantName}>{restaurant.name}</Text>
        <Text style={styles.restaurantCuisine}>{restaurant.cuisine}</Text>
        <View style={styles.restaurantMeta}>
          <Text style={styles.rating}>⭐ {restaurant.rating}</Text>
          <Text style={styles.price}>{getPriceString(restaurant.priceLevel)}</Text>
        </View>
        <Text style={styles.address} numberOfLines={1}>
          📍 {restaurant.address}
        </Text>
      </View>
      {selected && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
        </View>
      )}
    </TouchableOpacity>
  );

  const mealTime = getMealTime(selectedTime);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan a Food Date</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>with {partnerName} 💕</Text>

        {/* Restaurant Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🍽️ Choose a Restaurant</Text>
          {SAMPLE_RESTAURANTS.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              selected={selectedRestaurant?.id === restaurant.id}
              onPress={() => setSelectedRestaurant(restaurant)}
            />
          ))}
        </View>

        {/* Date & Time Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 When should we meet?</Text>

          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateTimeLabel}>Date</Text>
            <Text style={styles.dateTimeValue}>{formatDate(selectedDate)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.dateTimeLabel}>Time</Text>
            <Text style={styles.dateTimeValue}>
              {mealTime.emoji} {formatTime(selectedTime)} ({mealTime.name})
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}
        </View>

        {/* Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💌 Add a sweet message</Text>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder={`Write something nice to ${partnerName}...`}
            placeholderTextColor="rgba(255,255,255,0.6)"
            multiline
            maxLength={200}
          />
          <Text style={styles.charCount}>{message.length}/200</Text>
        </View>

        {/* Preview */}
        {selectedRestaurant && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>📋 Date Preview</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewText}>
                <Text style={styles.bold}>{selectedRestaurant.name}</Text>
                {'\n'}
                {selectedRestaurant.cuisine} • {getPriceString(selectedRestaurant.priceLevel)} • ⭐ {selectedRestaurant.rating}
                {'\n\n'}
                📅 {formatDate(selectedDate)}
                {'\n'}
                🕒 {formatTime(selectedTime)} ({mealTime.name})
                {'\n\n'}
                💌 "{message}"
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Send Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.disabledButton]}
          onPress={sendFoodDateProposal}
          disabled={loading || !selectedRestaurant}
        >
          <Text style={styles.sendButtonText}>
            {loading ? 'Sending...' : `🎉 Send Date Invite to ${partnerName}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffb6c1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  restaurantCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#f0fff0',
  },
  restaurantImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  restaurantCuisine: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  restaurantMeta: {
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
  selectedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  dateTimeButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTimeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dateTimeValue: {
    fontSize: 14,
    color: '#666',
  },
  messageInput: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  preview: {
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 20,
  },
  previewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
  },
  sendButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffb6c1',
  },
});