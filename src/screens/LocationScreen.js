import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, ActivityIndicator, TextInput, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../utils/supabase';
import { useFonts, SourGummy_700Bold } from '@expo-google-fonts/sour-gummy';

const { width, height } = Dimensions.get('window');
const foodEmojis = ['🍕', '🍔', '🍟', '🌮', '🍝', '🍜', '🍱', '🍣', '🥘', '🍲', '🥗', '🍰', '🧁', '🍪', '🍩', '🥐', '🥨', '🌭', '🥪', '🍖'];

const NEXT_ROUTE = 'ProfileDetails';

const FoodEmojiBackground = () => {
  const [currentEmoji, setCurrentEmoji] = useState(foodEmojis[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentEmoji(foodEmojis[Math.floor(Math.random() * foodEmojis.length)]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <View style={styles.pinkBackground} />
      <View style={styles.centerEmojiContainer}>
        <Text style={styles.centerEmoji}>
          {currentEmoji}
        </Text>
      </View>
    </View>
  );
};

export default function LocationScreen({ route, navigation }) {
  const likes = route.params?.likes || [];
  const displayName = route.params?.name || null;

  const [getting, setGetting] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  let [fontsLoaded] = useFonts({
    SourGummy_700Bold,
  });

  const getLocation = async () => {
    try {
      setGetting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is needed to suggest midpoint restaurants.');
        setGetting(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(String(pos.coords.latitude.toFixed(6)));
      setLng(String(pos.coords.longitude.toFixed(6)));
    } catch (e) {
      Alert.alert('Location error', e.message || String(e));
    } finally {
      setGetting(false);
    }
  };

  const saveAndProceed = async () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        Alert.alert('Invalid coordinates', 'Please enter valid latitude/longitude.');
        return;
    }
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not signed in');

        await supabase.rpc('set_profile', {
        p_name: displayName || user.email?.split('@')[0] || 'User',
        p_lat: latNum,
        p_lng: lngNum,
        p_likes: Array.isArray(likes) ? likes : [],
        p_dislikes: []
        });

        let ok = false, last;
        for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase
            .from('users_public')
            .select('lat,lng')
            .eq('user_id', user.id)
            .maybeSingle();
        last = data;
        if (error) break;
        const lt = typeof data?.lat === 'string' ? parseFloat(data.lat) : data?.lat;
        const lg = typeof data?.lng === 'string' ? parseFloat(data.lng) : data?.lng;
        if (Number.isFinite(lt) && Number.isFinite(lg)) { ok = true; break; }
        await new Promise(r => setTimeout(r, 250));
        }
        if (!ok) console.warn('users_public not ready yet:', last);

        navigation.replace('ProfileDetails', { fromLocation: true });
    } catch (e) {
        Alert.alert('Save error', e.message || String(e));
    }
    };

  useEffect(() => { getLocation(); }, []);

  return (
    <View style={styles.wrap}>
      <FoodEmojiBackground />
      <View style={styles.content}>
        <Text style={[styles.title, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>Share your location</Text>
        <Text style={[styles.sub, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>We'll use it to find restaurants near the midpoint.</Text>

        {getting && <ActivityIndicator style={{ marginVertical: 16 }} color="white" />}

        <View style={styles.lowerSection}>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Latitude"
              placeholderTextColor="rgba(255,255,255,0.7)"
              keyboardType="decimal-pad"
              value={lat}
              onChangeText={setLat}
            />
            <TextInput
              style={styles.input}
              placeholder="Longitude"
              placeholderTextColor="rgba(255,255,255,0.7)"
              keyboardType="decimal-pad"
              value={lng}
              onChangeText={setLng}
            />
          </View>

          <View style={styles.btns}>
            <TouchableOpacity style={styles.button} onPress={getLocation}>
              <Text style={[styles.buttonText, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
                Use current location
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={saveAndProceed}>
              <Text style={[styles.buttonText, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  pinkBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffb6c1',
  },
  centerEmojiContainer: {
    position: 'absolute',
    top: 280,
    left: 0,
    right: 0,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerEmoji: {
    fontSize: 120,
    opacity: 0.6,
    userSelect: 'none',
  },
  content: {
    flex: 1,
    padding: 20,
    zIndex: 1,
    paddingTop: 120,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
    color: 'white',
  },
  sub: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 40,
    fontSize: 18,
  },
  lowerSection: {
    marginTop: 200,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 40 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    padding: 10,
    color: 'white',
  },
  btns: { gap: 20, marginTop: 20 },
  button: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#ffb6c1',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
