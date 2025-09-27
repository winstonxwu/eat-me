import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '../utils/supabase';

const { width } = Dimensions.get('window');

const FOOD_CATEGORIES = [
  { id: 'italian', name: 'Italian', emoji: '🍝' },
  { id: 'japanese', name: 'Japanese', emoji: '🍣' },
  { id: 'mexican', name: 'Mexican', emoji: '🌮' },
  { id: 'chinese', name: 'Chinese', emoji: '🥟' },
  { id: 'indian', name: 'Indian', emoji: '🍛' },
  { id: 'american', name: 'American', emoji: '🍔' },
  { id: 'thai', name: 'Thai', emoji: '🍜' },
  { id: 'french', name: 'French', emoji: '🥐' },
  { id: 'korean', name: 'Korean', emoji: '🍲' },
  { id: 'mediterranean', name: 'Mediterranean', emoji: '🥗' },
  { id: 'seafood', name: 'Seafood', emoji: '🦐' },
  { id: 'vegetarian', name: 'Vegetarian', emoji: '🥕' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
  { id: 'pizza', name: 'Pizza', emoji: '🍕' },
  { id: 'bbq', name: 'BBQ', emoji: '🍖' },
  { id: 'breakfast', name: 'Breakfast', emoji: '🥞' },
];

export default function PreferencesScreen({ navigation }) {
  const [selectedPreferences, setSelectedPreferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    getUser();
  }, []);

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      loadExistingPreferences(user.id);
    }
  };

  const loadExistingPreferences = async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('likes')
        .eq('user_id', userId)
        .maybeSingle();

      if (data && data.likes) {
        setSelectedPreferences(data.likes);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const togglePreference = (categoryId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedPreferences(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const savePreferences = async () => {
    if (selectedPreferences.length === 0) {
      Alert.alert('Select Preferences', 'Please select at least one food category you like!');
      return;
    }

    setLoading(true);
    try {
      if (!user) {
        throw new Error('User not found');
      }

      await supabase.from('profiles').upsert({
        user_id: user.id,
        likes: selectedPreferences,
        dislikes: []
      });

      await supabase.from('users_public').upsert({
        user_id: user.id,
        name: user.email?.split('@')[0] || 'User',
        lat: 40.7128,
        lng: -74.0060
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('ForYou');
    } catch (error) {
      Alert.alert('Error', error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setLoading(false);
  };

  const renderCategory = (category) => {
    const isSelected = selectedPreferences.includes(category.id);

    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryCard,
          isSelected && styles.selectedCard
        ]}
        onPress={() => togglePreference(category.id)}
        activeOpacity={0.8}
      >
        <Text style={styles.emoji}>{category.emoji}</Text>
        <Text style={[
          styles.categoryName,
          isSelected && styles.selectedText
        ]}>
          {category.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>What do you love?</Text>
            <Text style={styles.subtitle}>
              Select your favorite food categories to get personalized recommendations
            </Text>
          </View>

          <View style={styles.categoriesContainer}>
            {FOOD_CATEGORIES.map(renderCategory)}
          </View>

          <View style={styles.footer}>
            <Text style={styles.selectedCount}>
              {selectedPreferences.length} categories selected
            </Text>

            <TouchableOpacity
              style={[
                styles.continueButton,
                selectedPreferences.length === 0 && styles.disabledButton,
                loading && styles.disabledButton
              ]}
              onPress={savePreferences}
              disabled={selectedPreferences.length === 0 || loading}
            >
              <Text style={styles.continueText}>
                {loading ? 'Saving...' : 'Continue to Feed'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  categoryCard: {
    width: (width - 60) / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'white',
    transform: [{ scale: 0.98 }],
  },
  emoji: {
    fontSize: 30,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedText: {
    color: 'white',
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  selectedCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  continueText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
  },
});