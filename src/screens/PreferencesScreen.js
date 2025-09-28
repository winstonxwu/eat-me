import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../utils/supabase';

const { width } = Dimensions.get('window');

const FOOD_CATEGORIES = [
  {
    category: 'Japanese',
    items: [
      { id: 'sushi', name: 'Sushi', emoji: '🍣' },
      { id: 'ramen', name: 'Ramen', emoji: '🍜' },
      { id: 'udon', name: 'Udon', emoji: '🍲' },
      { id: 'tempura', name: 'Tempura', emoji: '🍤' },
      { id: 'okonomiyaki', name: 'Okonomiyaki', emoji: '🥞' },
      { id: 'takoyaki', name: 'Takoyaki', emoji: '🐙' },
    ],
  },
  {
    category: 'Chinese',
    items: [
      { id: 'dumplings', name: 'Dumplings', emoji: '🥟' },
      { id: 'mapo_tofu', name: 'Mapo Tofu', emoji: '🍲' },
      { id: 'peking_duck', name: 'Peking Duck', emoji: '🦆' },
      { id: 'baozi', name: 'Baozi (Steamed Bun)', emoji: '🥟' },
      { id: 'hotpot', name: 'Hotpot', emoji: '🍲' },
    ],
  },
  {
    category: 'Korean',
    items: [
      { id: 'kimchi', name: 'Kimchi', emoji: '🥬' },
      { id: 'bibimbap', name: 'Bibimbap', emoji: '🍲' },
      { id: 'tteokbokki', name: 'Tteokbokki', emoji: '🍢' },
      { id: 'samgyeopsal', name: 'Samgyeopsal (Pork Belly)', emoji: '🥓' },
    ],
  },
  {
    category: 'Southeast Asian',
    items: [
      { id: 'pho', name: 'Pho', emoji: '🍜' },
      { id: 'banh_mi', name: 'Banh Mi', emoji: '🥖' },
      { id: 'pad_thai', name: 'Pad Thai', emoji: '🍤' },
      { id: 'satay', name: 'Satay', emoji: '🍢' },
      { id: 'nasi_goreng', name: 'Nasi Goreng', emoji: '🍚' },
    ],
  },
  {
    category: 'South Asian',
    items: [
      { id: 'curry', name: 'Curry', emoji: '🍛' },
      { id: 'biryani', name: 'Biryani', emoji: '🍚' },
      { id: 'tandoori_chicken', name: 'Tandoori Chicken', emoji: '🍗' },
      { id: 'samosa', name: 'Samosa', emoji: '🥟' },
      { id: 'naan', name: 'Naan', emoji: '🥖' },
    ],
  },
  {
    category: 'European',
    items: [
      { id: 'pizza', name: 'Pizza', emoji: '🍕' },
      { id: 'pasta', name: 'Pasta', emoji: '🍝' },
      { id: 'risotto', name: 'Risotto', emoji: '🍚' },
      { id: 'paella', name: 'Paella', emoji: '🥘' },
      { id: 'croissant', name: 'Croissant', emoji: '🥐' },
      { id: 'baguette', name: 'Baguette', emoji: '🥖' },
      { id: 'wurst', name: 'German Sausage', emoji: '🌭' },
    ],
  },
  {
    category: 'American & Latin',
    items: [
      { id: 'burger', name: 'Burger', emoji: '🍔' },
      { id: 'hotdog', name: 'Hot Dog', emoji: '🌭' },
      { id: 'fried_chicken', name: 'Fried Chicken', emoji: '🍗' },
      { id: 'tacos', name: 'Tacos', emoji: '🌮' },
      { id: 'burrito', name: 'Burrito', emoji: '🌯' },
      { id: 'nachos', name: 'Nachos', emoji: '🧀' },
      { id: 'steak', name: 'Steak', emoji: '🥩' },
    ],
  },
  {
    category: 'Desserts',
    items: [
      { id: 'icecream', name: 'Ice Cream', emoji: '🍦' },
      { id: 'cake', name: 'Cake', emoji: '🍰' },
      { id: 'donut', name: 'Donut', emoji: '🍩' },
      { id: 'macaron', name: 'Macaron', emoji: '🟣' },
      { id: 'churros', name: 'Churros', emoji: '🥖' },
      { id: 'pudding', name: 'Pudding', emoji: '🍮' },
      { id: 'chocolate', name: 'Chocolate', emoji: '🍫' },
    ],
  },
  {
    category: 'Drinks',
    items: [
      { id: 'coffee', name: 'Coffee', emoji: '☕' },
      { id: 'tea', name: 'Tea', emoji: '🍵' },
      { id: 'beer', name: 'Beer', emoji: '🍺' },
      { id: 'wine', name: 'Wine', emoji: '🍷' },
      { id: 'cocktail', name: 'Cocktail', emoji: '🍹' },
      { id: 'boba', name: 'Bubble Tea', emoji: '🧋' },
    ],
  },
  {
    category: 'Others',
    items: [
      { id: 'sandwich', name: 'Sandwich', emoji: '🥪' },
      { id: 'salad', name: 'Salad', emoji: '🥗' },
      { id: 'soup', name: 'Soup', emoji: '🥣' },
      { id: 'fries', name: 'French Fries', emoji: '🍟' },
      { id: 'popcorn', name: 'Popcorn', emoji: '🍿' },
    ],
  },
];



export default function PreferencesScreen({ navigation }) {
  const [selectedPreferences, setSelectedPreferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!user) return;
    const { data } = await supabase.from('profiles').select('likes').eq('user_id', user.id).maybeSingle();
    if (data?.likes) setSelectedPreferences(data.likes);
  })(); }, []);

  const togglePreference = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPreferences((prev) => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const continueToProfile = async () => {
    console.log('continueToProfile called');
    if (selectedPreferences.length === 0) {
      Alert.alert('Select at least one');
      return;
    }
    if (!user) {
      Alert.alert('Not signed in');
      return;
    }
    console.log('Navigating to ProfileDetails with likes:', selectedPreferences);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptics error:', error);
    }

    console.log('About to navigate to ProfileDetails');
    try {
      navigation.replace('ProfileDetails', {
        likes: selectedPreferences,
      });
      console.log('Navigation call completed successfully');
    } catch (navError) {
      console.log('Navigation error:', navError);
      Alert.alert('Navigation Error', navError.message);
    }
  };

  const renderFoodItem = (item) => {
    const isSelected = selectedPreferences.includes(item.id);
    return (
      <TouchableOpacity key={item.id} style={[styles.categoryCard, isSelected && styles.selectedCard]} onPress={() => togglePreference(item.id)} activeOpacity={0.8}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <Text style={[styles.categoryName, isSelected && styles.selectedText]}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderCategory = (categoryData) => {
    return (
      <View key={categoryData.category} style={styles.categorySection}>
        <Text style={styles.categoryTitle}>{categoryData.category}</Text>
        <View style={styles.categoryItems}>
          {categoryData.items.map(renderFoodItem)}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pinkBackground} />
      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>What do you love?</Text>
            <Text style={styles.subtitle}>Select your favorite food categories</Text>
          </View>
          <View style={styles.categoriesContainer}>{FOOD_CATEGORIES.map(renderCategory)}</View>
          <View style={styles.footer}>
            <Text style={styles.selectedCount}>{selectedPreferences.length} selected</Text>
            <TouchableOpacity style={[styles.continueButton, selectedPreferences.length===0 && styles.disabledButton]} onPress={continueToProfile} disabled={selectedPreferences.length===0}>
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pinkBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#ffb6c1' },
  content: { flex: 1, zIndex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 },
  header: { paddingTop: 20, paddingBottom: 30, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 },
  categoriesContainer: { marginBottom: 30 },
  categorySection: { marginBottom: 20 },
  categoryTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  categoryItems: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryCard: { width: (width - 60) / 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 20, marginBottom: 15, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  selectedCard: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'white', transform: [{ scale: 0.98 }] },
  emoji: { fontSize: 30, marginBottom: 8 },
  categoryName: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' },
  selectedText: { color: 'white', fontWeight: 'bold' },
  footer: { alignItems: 'center', marginTop: 20 },
  selectedCount: { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 20 },
  continueButton: { backgroundColor: 'white', borderRadius: 25, paddingVertical: 15, paddingHorizontal: 40, minWidth: 200, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, marginBottom: 15 },
  skipButton: { backgroundColor: 'transparent', borderWidth: 2, borderColor: 'white', borderRadius: 25, paddingVertical: 15, paddingHorizontal: 40, minWidth: 200, alignItems: 'center' },
  disabledButton: { opacity: 0.5 },
  continueText: { color: '#667eea', fontSize: 18, fontWeight: 'bold' },
  skipText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
