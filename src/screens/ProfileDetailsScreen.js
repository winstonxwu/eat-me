import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, SourGummy_700Bold } from '@expo-google-fonts/sour-gummy';
import { supabase } from '../utils/supabase';
import { uploadImageToSupabase } from '../utils/imageUpload';

const { height } = Dimensions.get('window');

function stripBust(u) {
  if (!u) return u;
  const i = u.indexOf('?');
  return i >= 0 ? u.slice(0, i) : u;
}

export default function ProfileDetailsScreen({ route, navigation }) {
  const likes = route.params?.likes || [];
  const [name, setName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {}, []);

  let [fontsLoaded] = useFonts({
    SourGummy_700Bold,
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to select your food photo!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera permissions to take your food photo!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0]);
    }
  };

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return;
    }
    if (!selectedImage) {
      Alert.alert('Photo required', 'Please select a food photo that represents your personality.');
      return;
    }
    setUploading(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Not authenticated');

      let imageUrl = selectedImage?.uri ?? null;
      try {
        const uploaded = await uploadImageToSupabase(localUri, user.id);
        const uploadedUrl = typeof uploaded === 'string' ? uploaded : uploaded?.publicUrl || null;
        if (uploadedUrl) imageUrl = stripBust(uploadedUrl);
      } catch {}

      const { error: up1 } = await supabase.from('users_public').upsert({
        user_id: user.id,
        name: name.trim(),
      });
      if (up1) throw up1;

      const { error: up2 } = await supabase.from('profiles').upsert({
        user_id: user.id,
        profile_photo: imageUrl,
        likes: likes,
      });
      if (up2) throw up2;

      navigation.replace('LocationScreen', {
        likes: likes,
        name: name.trim(),
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save profile. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.pinkBackground} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
          Complete Your Profile
        </Text>
        <Text style={[styles.subtitle, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
          Tell us a bit about yourself!
        </Text>
        <View style={styles.section}>
          <Text style={[styles.label, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
            What's your name?
          </Text>
          <TextInput
            style={styles.nameInput}
            placeholder="Enter your name"
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
            Share a food photo that represents your personality
          </Text>
          {selectedImage ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
              <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage}>
                <Text style={[styles.changePhotoText, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
                  Change Photo
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                <Text style={styles.photoButtonIcon}>📱</Text>
                <Text style={[styles.photoButtonText, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
                  Choose from Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                <Text style={styles.photoButtonIcon}>📷</Text>
                <Text style={[styles.photoButtonText, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
                  Take Photo
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.continueButton, (!name.trim() || !selectedImage || uploading) && styles.disabledButton]}
          onPress={handleContinue}
          disabled={!name.trim() || !selectedImage || uploading}
        >
          <Text style={[styles.continueButtonText, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
            {uploading ? 'Creating Profile...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pinkBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#ffb6c1' },
  content: { flex: 1, paddingHorizontal: 30, paddingTop: 80, zIndex: 1 },
  title: { fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 50 },
  section: { marginBottom: 60 },
  label: { fontSize: 20, color: 'white', fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 18,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
  imageContainer: { alignItems: 'center' },
  selectedImage: { width: 200, height: 200, borderRadius: 20, marginBottom: 15 },
  changePhotoButton: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  changePhotoText: { color: '#ffb6c1', fontSize: 16, fontWeight: 'bold' },
  photoButtons: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0, marginTop: 20, gap: 30, marginLeft: -15 },
  photoButton: { backgroundColor: 'rgba(255,255,255,0.9)', paddingVertical: 20, paddingHorizontal: 25, borderRadius: 20, alignItems: 'center', flex: 1 },
  photoButtonIcon: { fontSize: 30, marginBottom: 10 },
  photoButtonText: { color: '#ffb6c1', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  continueButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  disabledButton: { opacity: 0.5 },
  continueButtonText: { color: '#ffb6c1', fontSize: 20, fontWeight: 'bold' },
});
