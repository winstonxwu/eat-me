import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, Dimensions } from 'react-native';
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

  const renderCategory = (c) => {
    const isSelected = selectedPreferences.includes(c.id);
    return (
      <TouchableOpacity key={c.id} style={[styles.categoryCard, isSelected && styles.selectedCard]} onPress={() => togglePreference(c.id)} activeOpacity={0.8}>
        <Text style={styles.emoji}>{c.emoji}</Text>
        <Text style={[styles.categoryName, isSelected && styles.selectedText]}>{c.name}</Text>
      </TouchableOpacity>
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
  categoriesContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 30 },
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
