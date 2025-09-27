import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { uploadImageToSupabase } from '../utils/imageUpload';

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

const VALID_PREFS = new Set(FOOD_CATEGORIES.map(c => c.id));
const norm = (arr) => Array.isArray(arr) ? arr.map(t => String(t).trim().toLowerCase()).filter(Boolean) : [];

const TAG_TO_CATEGORY = {
  ramen: 'japanese',
  sushi: 'japanese',
  udon: 'japanese',
  soba: 'japanese',
  tempura: 'japanese',
  pizza: 'pizza',
  pasta: 'italian',
  lasagna: 'italian',
  taco: 'mexican',
  burrito: 'mexican',
  quesadilla: 'mexican',
  dimsum: 'chinese',
  dumpling: 'chinese',
  curry: 'indian',
  kebab: 'mediterranean',
  shawarma: 'mediterranean',
  burger: 'american',
  hamburger: 'american',
  bbq: 'bbq',
  brisket: 'bbq',
  kimchi: 'korean',
  bulgogi: 'korean',
  bibimbap: 'korean',
  pho: 'thai',
  padthai: 'thai',
  croissant: 'french',
  macaron: 'french',
  seafood: 'seafood',
  vegetarian: 'vegetarian',
  salad: 'mediterranean',
  dessert: 'desserts',
  cake: 'desserts',
  pancake: 'breakfast',
  waffle: 'breakfast',
};

function inferCategoriesFromLikes(rawLikes) {
  const cats = new Set();
  for (const t of norm(rawLikes)) {
    if (VALID_PREFS.has(t)) { cats.add(t); continue; }
    const mapped = TAG_TO_CATEGORY[t];
    if (mapped && VALID_PREFS.has(mapped)) cats.add(mapped);
  }
  return Array.from(cats);
}

function stripBust(u) {
  if (!u) return u;
  const i = u.indexOf('?');
  return i >= 0 ? u.slice(0, i) : u;
}

function withBustOnce(u) {
  const raw = stripBust(u);
  return `${raw}?v=${Date.now()}`;
}

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [photoMime, setPhotoMime] = useState(null);
  const [photoName, setPhotoName] = useState(null);
  const [selectedPreferences, setSelectedPreferences] = useState([]);
  const [rawLikes, setRawLikes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const toPublicUrl = async (maybePath) => {
    if (!maybePath) return null;
    if (/^https?:\/\//i.test(maybePath)) return withBustOnce(maybePath);
    const { data } = supabase.storage.from('profiles').getPublicUrl(maybePath);
    return data?.publicUrl ? withBustOnce(data.publicUrl) : null;
  };

  const loadProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;
      setUser(currentUser);

      const { data: publicProfile } = await supabase
        .from('users_public').select('name')
        .eq('user_id', currentUser.id).maybeSingle();

      const { data: profile } = await supabase
        .from('profiles').select('bio, profile_photo, likes')
        .eq('user_id', currentUser.id).maybeSingle();

      if (publicProfile?.name) setName(publicProfile.name);
      if (profile?.bio) setBio(profile.bio);

      const dbLikes = Array.isArray(profile?.likes) ? profile.likes : [];
      setRawLikes(dbLikes);
      setSelectedPreferences(inferCategoriesFromLikes(dbLikes));

      if (profile?.profile_photo) {
        const url = await toPublicUrl(profile.profile_photo);
        setProfileImage(url || null);
      } else {
        setProfileImage(null);
      }
    } catch (e) {
      Alert.alert('Load error', e.message || String(e));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'We need camera roll permissions to select your photo!'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Image,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileImage(result.assets[0].uri);
      setPhotoMime(result.assets[0].mimeType || null);
      setPhotoName(result.assets[0].fileName || null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'We need camera permissions to take your photo!'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaType.Image,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileImage(result.assets[0].uri);
      setPhotoMime(result.assets[0].mimeType || null);
      setPhotoName(result.assets[0].fileName || null);
    }
  };

  const togglePreference = (id) => {
    const key = String(id).toLowerCase();
    if (!VALID_PREFS.has(key)) return;
    setSelectedPreferences(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]));
  };

  const saveProfile = async () => {
    if (!user) { Alert.alert('Error', 'Please sign in first'); return; }
    if (!name.trim()) { Alert.alert('Error', 'Please enter your name'); return; }

    setLoading(true);
    try {
      const { error: publicError } = await supabase
        .from('users_public')
        .upsert({ user_id: user.id, name: name.trim() }, { onConflict: 'user_id' })
        .select().single();
      if (publicError) throw publicError;

      let photoUrl = null;
      if (profileImage) {
        if (profileImage.startsWith('file://') || profileImage.startsWith('content://')) {
          const uploaded = await uploadImageToSupabase(profileImage, user.id);
          const uploadedUrl = typeof uploaded === 'string' ? uploaded : uploaded?.publicUrl || null;
          if (uploadedUrl) {
            setProfileImage(withBustOnce(uploadedUrl));
            photoUrl = stripBust(uploadedUrl);
          }
        } else {
          photoUrl = stripBust(profileImage);
        }
      }

      const existing = new Set(norm(rawLikes));
      for (const v of Array.from(existing)) { if (VALID_PREFS.has(v)) existing.delete(v); }
      for (const cat of selectedPreferences) { if (VALID_PREFS.has(cat)) existing.add(cat); }
      const newLikes = Array.from(existing);

      const baseProfile = { user_id: user.id, bio: bio.trim(), likes: newLikes };
      const payload = photoUrl ? { ...baseProfile, profile_photo: photoUrl } : baseProfile;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select().single();
      if (profileError) throw profileError;

      await loadProfile();
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); navigation.replace('Login'); }
    catch { Alert.alert('Error', 'Failed to sign out'); }
  };

  const renderCategory = (category) => {
    const isSelected = selectedPreferences.includes(category.id);
    return (
      <TouchableOpacity
        key={category.id}
        style={[styles.categoryCard, isSelected && styles.selectedCard]}
        onPress={() => togglePreference(category.id)}
        activeOpacity={0.8}
      >
        <Text style={styles.emoji}>{category.emoji}</Text>
        <Text style={[styles.categoryName, isSelected && styles.selectedText]}>{category.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pinkBackground} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
        </View>

        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profilePhoto}
                resizeMode="cover"
                onLoad={() => console.log('IMAGE loaded:', profileImage)}
                onError={(e) => console.log('IMAGE error:', profileImage, e.nativeEvent)}
              />
            ) : (
              <View style={styles.placeholderPhoto}>
                <Ionicons name="person" size={60} color="rgba(255,255,255,0.7)" />
              </View>
            )}
            <View style={styles.photoOverlay}>
              <Ionicons name="camera" size={24} color="white" />
            </View>
          </TouchableOpacity>

          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              <Ionicons name="images" size={20} color="#ffb6c1" />
              <Text style={styles.photoButtonText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera" size={20} color="#ffb6c1" />
              <Text style={styles.photoButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Tell others about yourself..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={bio}
            onChangeText={setBio}
            maxLength={200}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.charCount}>{bio.length}/200</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Food Preferences</Text>
          <Text style={styles.sectionSubtitle}>
            Select your favorite food categories ({selectedPreferences.length} selected)
          </Text>
          <View style={styles.categoriesContainer}>{FOOD_CATEGORIES.map(renderCategory)}</View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.disabledButton]}
            onPress={saveProfile}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Profile'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pinkBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#ffb6c1' },
  content: { flex: 1, zIndex: 1 },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  photoSection: { alignItems: 'center', marginBottom: 30 },
  photoContainer: { position: 'relative', marginBottom: 15 },
  profilePhoto: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: 'white' },
  placeholderPhoto: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: 'white' },
  photoOverlay: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  photoButtons: { flexDirection: 'row', gap: 15 },
  photoButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, gap: 5 },
  photoButtonText: { color: '#ffb6c1', fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 25, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  sectionSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 15 },
  input: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: 'white', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  bioInput: { height: 80, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  categoriesContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryCard: { width: (width - 60) / 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 15, marginBottom: 10, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  selectedCard: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'white' },
  emoji: { fontSize: 24, marginBottom: 5 },
  categoryName: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' },
  selectedText: { color: 'white', fontWeight: 'bold' },
  buttonContainer: { paddingHorizontal: 20, paddingBottom: 30, gap: 15 },
  saveButton: { backgroundColor: 'white', borderRadius: 25, paddingVertical: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  disabledButton: { opacity: 0.5 },
  saveButtonText: { color: '#ffb6c1', fontSize: 18, fontWeight: 'bold' },
  signOutButton: { backgroundColor: 'transparent', borderWidth: 2, borderColor: 'white', borderRadius: 25, paddingVertical: 15, alignItems: 'center' },
  signOutButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
