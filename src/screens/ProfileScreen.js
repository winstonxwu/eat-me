import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { uploadImageToSupabase, getImagePublicUrl, deleteImageFromSupabase } from '../utils/imageUpload';


export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState(null); // Display URL
  const [profileStorageKey, setProfileStorageKey] = useState(null); // Storage key
  const [pendingImageUri, setPendingImageUri] = useState(null); // Local URI waiting to be uploaded
  const [imageLoadFailed, setImageLoadFailed] = useState(false); // Track if current image failed to load
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;
      setUser(currentUser);

      console.log('Loading profile for user:', currentUser.id);

      // Load user's public info (name)
      const { data: publicProfile } = await supabase
        .from('users_public')
        .select('name')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      // Load user's profile info (bio, profile_photo)
      const { data: profile } = await supabase
        .from('profiles')
        .select('bio, profile_photo')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      console.log('Profile data loaded:', { publicProfile, profile });

      if (publicProfile?.name) setName(publicProfile.name);
      if (profile?.bio) setBio(profile.bio);

      // Handle profile photo - now expecting a storage key, not a URL
      if (profile?.profile_photo) {
        console.log('Profile photo found:', profile.profile_photo);

        // Check if it's already a storage key or an old-style URL that needs fixing
        if (profile.profile_photo.startsWith('http')) {
          // Old-style URL - clear it so user can re-upload
          console.log('Found old-style URL, clearing it');
          setProfileImageUrl(null);
          setProfileStorageKey(null);
        } else {
          // It's a storage key - generate the public URL
          setProfileStorageKey(profile.profile_photo);
          const publicUrl = getImagePublicUrl(profile.profile_photo);
          setProfileImageUrl(publicUrl);
          console.log('Generated public URL:', publicUrl);
        }
      } else {
        setProfileImageUrl(null);
        setProfileStorageKey(null);
      }

      // Clear any pending upload
      setPendingImageUri(null);

    } catch (e) {
      console.error('Profile load error:', e);
      Alert.alert('Load error', e.message || String(e));
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need camera roll permissions to select your photo!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      console.log('Gallery picker result:', result);

      if (!result.canceled && result.assets[0]) {
        const selectedUri = result.assets[0].uri;
        console.log('Gallery image selected:', selectedUri);

        // Set the local URI for pending upload
        setPendingImageUri(selectedUri);

        // For immediate display, keep the local URI but clear the remote URL
        setProfileImageUrl(selectedUri);
        // Clear the storage key since we have a new image
        setProfileStorageKey(null);
        // Reset image load failure state
        setImageLoadFailed(false);
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
      Alert.alert('Error', 'Failed to pick image from gallery');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need camera permissions to take your photo!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        const takenUri = result.assets[0].uri;
        console.log('Camera image taken:', takenUri);

        // Set the local URI for pending upload
        setPendingImageUri(takenUri);

        // For immediate display, keep the local URI but clear the remote URL
        setProfileImageUrl(takenUri);
        // Clear the storage key since we have a new image
        setProfileStorageKey(null);
        // Reset image load failure state
        setImageLoadFailed(false);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const saveProfile = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting profile save...');

      // Save user's public info (name)
      const { error: publicError } = await supabase
        .from('users_public')
        .upsert({ user_id: user.id, name: name.trim() }, { onConflict: 'user_id' })
        .select().single();

      if (publicError) throw publicError;

      // Handle image upload if there's a new image
      let newStorageKey = profileStorageKey; // Keep existing key by default

      if (pendingImageUri) {
        console.log('Uploading new image:', pendingImageUri);

        try {
          // Delete old image if it exists
          if (profileStorageKey) {
            console.log('Deleting old image:', profileStorageKey);
            await deleteImageFromSupabase(profileStorageKey);
          }

          // Upload new image
          const uploadResult = await uploadImageToSupabase(pendingImageUri, user.id);
          console.log('Upload successful:', uploadResult);

          // Use the storage key (not the URL) for database storage
          newStorageKey = uploadResult.storageKey;

          // Update display URL with the new URL
          setProfileImageUrl(uploadResult.publicUrl);
          setProfileStorageKey(newStorageKey);

          // Clear pending upload
          setPendingImageUri(null);

        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          Alert.alert('Upload Error', `Failed to upload image: ${uploadError.message}`);
          setLoading(false);
          return;
        }
      }

      // Save profile data (bio and profile_photo storage key)
      const profilePayload = {
        user_id: user.id,
        bio: bio.trim(),
      };

      // Only include profile_photo if we have a storage key
      if (newStorageKey) {
        profilePayload.profile_photo = newStorageKey;
      }

      console.log('Saving profile payload:', profilePayload);

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'user_id' })
        .select().single();

      if (profileError) throw profileError;

      console.log('Profile saved successfully');
      Alert.alert('Success', 'Profile updated successfully!');

    } catch (e) {
      console.error('Save profile error:', e);
      Alert.alert('Error', e.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); navigation.replace('Login'); }
    catch { Alert.alert('Error', 'Failed to sign out'); }
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
            {profileImageUrl && !imageLoadFailed ? (
              <Image
                source={{
                  uri: profileImageUrl,
                  cache: 'reload' // Force reload to avoid cache issues
                }}
                style={styles.profilePhoto}
                resizeMode="cover"
                onLoad={() => console.log('✅ Image loaded successfully:', profileImageUrl.substring(0, 50) + '...')}
                onLoadStart={() => console.log('🔄 Image loading started:', profileImageUrl.substring(0, 50) + '...')}
                onError={(error) => {
                  console.error('❌ Image load error:', error);
                  console.error('Failed URI:', profileImageUrl);
                  console.error('Error details:', error?.nativeEvent);

                  // Mark image as failed to load
                  setImageLoadFailed(true);

                  // Only show alert for remote URLs (not local file:// URIs during preview)
                  if (!profileImageUrl.startsWith('file://') && !profileImageUrl.startsWith('content://')) {
                    console.log('Remote image failed to load');
                  } else {
                    console.log('Local image load failed, this is normal on some devices');
                  }
                }}
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
  input: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: 'white', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  bioInput: { height: 80, textAlignVertical: 'top' },
  charCount: { textAlign: 'right', color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  buttonContainer: { paddingHorizontal: 20, paddingBottom: 30, gap: 15 },
  saveButton: { backgroundColor: 'white', borderRadius: 25, paddingVertical: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  disabledButton: { opacity: 0.5 },
  saveButtonText: { color: '#ffb6c1', fontSize: 18, fontWeight: 'bold' },
  signOutButton: { backgroundColor: 'transparent', borderWidth: 2, borderColor: 'white', borderRadius: 25, paddingVertical: 15, alignItems: 'center' },
  signOutButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
