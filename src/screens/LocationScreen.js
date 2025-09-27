import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, ActivityIndicator, TextInput, StyleSheet, Dimensions, TouchableOpacity, Keyboard, TouchableWithoutFeedback } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../utils/supabase';
import { useFonts, SourGummy_700Bold } from '@expo-google-fonts/sour-gummy';

const { width, height } = Dimensions.get('window');
const foodEmojis = ['🍕', '🍔', '🍟', '🌮', '🍝', '🍜', '🍱', '🍣', '🥘', '🍲', '🥗', '🍰', '🧁', '🍪', '🍩', '🥐', '🥨', '🌭', '🥪', '🍖'];

const NEXT_ROUTE = 'MainTabs';

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
  const [zipcode, setZipcode] = useState('');

  let [fontsLoaded] = useFonts({
    SourGummy_700Bold,
  });

  const getLocationZipcode = async () => {
    try {
      setGetting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is needed to get your zipcode.');
        setGetting(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [reverseGeocode] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (reverseGeocode?.postalCode) {
        setZipcode(reverseGeocode.postalCode);
      } else {
        Alert.alert('Location error', 'Could not determine zipcode from your location.');
      }
    } catch (e) {
      Alert.alert('Location error', e.message || String(e));
    } finally {
      setGetting(false);
    }
  };

  const saveAndProceed = async () => {
    if (!zipcode || zipcode.trim() === '') {
        Alert.alert('Invalid zipcode', 'Please enter a valid zipcode.');
        return;
    }
    const zipcodeNum = parseInt(zipcode.trim());
    if (!Number.isInteger(zipcodeNum) || zipcodeNum < 10000 || zipcodeNum > 99999) {
        Alert.alert('Invalid zipcode', 'Please enter a 5-digit US zipcode.');
        return;
    }
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not signed in');

        console.log('Saving profile with zipcode:', zipcodeNum);
        const userName = displayName || user.email?.split('@')[0] || 'User';
        const userLikes = Array.isArray(likes) ? likes : [];

        // Try RPC function first
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('set_profile', {
                p_name: userName,
                p_zipcode: zipcodeNum,
                p_likes: userLikes,
                p_dislikes: []
            });

            if (rpcError) throw rpcError;
            console.log('RPC set_profile succeeded:', rpcData);
        } catch (rpcError) {
            console.log('RPC set_profile failed, using fallback:', rpcError.message);

            // Fallback: Direct database operations
            const { error: publicError } = await supabase
                .from('users_public')
                .upsert({
                    user_id: user.id,
                    name: userName,
                    zipcode: zipcodeNum
                });

            if (publicError) {
                console.error('users_public upsert error:', publicError);
                throw publicError;
            }

            // Save preferences if we have them
            if (userLikes.length > 0) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        user_id: user.id,
                        likes: userLikes,
                        dislikes: []
                    });

                if (profileError) {
                    console.warn('Profile likes save failed:', profileError);
                    // Don't throw here, zipcode save is more critical
                }
            }

            console.log('Fallback profile save completed successfully');
        }

        let ok = false, last;
        for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase
            .from('users_public')
            .select('zipcode')
            .eq('user_id', user.id)
            .maybeSingle();
        last = data;
        console.log(`Verification attempt ${i + 1}:`, { data, error });
        if (error) {
            console.error('Error reading users_public:', error);
            break;
        }
        const zc = typeof data?.zipcode === 'string' ? parseInt(data.zipcode) : data?.zipcode;
        console.log(`Zipcode verification - raw: ${data?.zipcode}, parsed: ${zc}, isInteger: ${Number.isInteger(zc)}`);
        if (Number.isInteger(zc)) { ok = true; break; }
        await new Promise(r => setTimeout(r, 250));
        }
        if (!ok) {
            console.warn('users_public not ready yet:', last);
            console.warn('Final verification failed - proceeding anyway');
        }

        navigation.replace('MainTabs', { fromLocation: true });
    } catch (e) {
        Alert.alert('Save error', e.message || String(e));
    }
    };

  useEffect(() => { getLocationZipcode(); }, []);

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <View style={styles.wrap}>
        <FoodEmojiBackground />
        <View style={styles.content}>
        <Text style={[styles.title, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>Share your location</Text>
        <Text style={[styles.sub, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>Enter your zipcode to find matches in your area.</Text>

        {getting && <ActivityIndicator style={{ marginVertical: 16 }} color="white" />}

        <View style={styles.lowerSection}>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 0, width: 200, alignSelf: 'center' }]}
              placeholder="Zipcode (e.g. 90210)"
              placeholderTextColor="rgba(255,255,255,0.7)"
              keyboardType="numeric"
              maxLength={5}
              value={zipcode}
              onChangeText={setZipcode}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              blurOnSubmit={true}
            />
          </View>

          <View style={styles.btns}>
            <TouchableOpacity style={styles.button} onPress={getLocationZipcode}>
              <Text style={[styles.buttonText, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>
                Get my zipcode
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
    </TouchableWithoutFeedback>
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
  row: { flexDirection: 'row', gap: 10, marginBottom: 40, justifyContent: 'center' },
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
