import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated
} from 'react-native';
import { useFonts, MsMadi_400Regular } from '@expo-google-fonts/ms-madi';
import { SourGummy_700Bold } from '@expo-google-fonts/sour-gummy';
import { supabase } from '../utils/supabase';
import { Colors } from '../constants';

const { width, height } = Dimensions.get('window');

const ROUTES = {
  preferences: 'Preferences',
  fyp: 'ForYouScreen',
};

const foodEmojis = ['🍕', '🍔', '🍟', '🌮', '🍝', '🍜', '🍱', '🍣', '🥘', '🍲', '🥗', '🍰', '🧁', '🍪', '🍩', '🥐', '🥨', '🌭', '🥪', '🍖'];

const FoodEmojiBackground = () => {
  const [currentEmojis, setCurrentEmojis] = useState([]);
  const animatedValues = useRef([]).current;

  useEffect(() => {
    const generateEmojis = () => {
      const emojis = [];
      const numEmojis = 20;

      // Clear previous animated values
      animatedValues.forEach(anim => anim.stopAnimation());
      animatedValues.length = 0;

      for (let i = 0; i < numEmojis; i++) {
        const animatedValue = new Animated.Value(-200);
        animatedValues.push(animatedValue);

        emojis.push({
          id: i,
          emoji: foodEmojis[Math.floor(Math.random() * foodEmojis.length)],
          left: Math.random() * (width - 50),
          size: 20 + Math.random() * 30,
          opacity: 0.3 + Math.random() * 0.4,
          speed: 3000 + Math.random() * 7000, // 3-10 seconds
          delay: Math.random() * 5000, // 0-5 second delay
          animatedValue: animatedValue,
        });
      }
      setCurrentEmojis(emojis);

      // Start animations for each emoji
      emojis.forEach((emoji, index) => {
        const startFalling = () => {
          emoji.animatedValue.setValue(-200);
          Animated.timing(emoji.animatedValue, {
            toValue: height + 100,
            duration: emoji.speed,
            useNativeDriver: true,
          }).start(() => {
            // Restart the animation when it completes
            startFalling();
          });
        };

        // Start with delay
        setTimeout(startFalling, emoji.delay);
      });
    };

    generateEmojis();

    return () => {
      animatedValues.forEach(anim => anim.stopAnimation());
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <View style={styles.gradientBackground} />
      <View style={StyleSheet.absoluteFillObject}>
        {currentEmojis.map((item) => (
          <Animated.Text
            key={item.id}
            style={[
              styles.foodEmoji,
              {
                left: item.left,
                fontSize: item.size,
                opacity: item.opacity,
                transform: [{ translateY: item.animatedValue }],
              },
            ]}
          >
            {item.emoji}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
};

export default function LoginScreen({ navigation }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  let [fontsLoaded] = useFonts({
    MsMadi_400Regular,
    SourGummy_700Bold,
  });

 useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await routeAfterAuth();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await routeAfterAuth();
      }
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const routeAfterAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      navigation.replace('Preferences');
    }
  };

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      navigation.replace('Preferences');
    }
  };

  const handleAuth = async () => {
    const mail = (email || '').trim().toLowerCase();
    const pass = password || '';

    if (!mail || !pass) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (pass.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error: upErr } = await supabase.auth.signUp({
          email: mail,
          password: pass,
          options: {
            emailRedirectTo: undefined
          }
        });
        if (upErr) throw upErr;

        if (data.user && !data.user.email_confirmed_at) {
          Alert.alert('Success', 'Account created! We sent a verification email, but you can start using the app now.');
        }

        await supabase.auth.signInWithPassword({ email: mail, password: pass });
      } else {
        const { error: inErr } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
        if (inErr) throw inErr;
      }
    } catch (e) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={styles.container}>
      <FoodEmojiBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, fontsLoaded && { fontFamily: 'SourGummy_700Bold' }]}>eatme</Text>
            <Text style={[styles.subtitle, fontsLoaded && { fontFamily: 'MsMadi_400Regular' }]}>
              love at first bite
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleAuth}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={styles.switchText}>
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"
                }
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffb6c1',
  },
  foodEmoji: {
    position: 'absolute',
    userSelect: 'none',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 150,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 60,
    fontWeight: '900',
    color: 'white',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  button: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 30,
    alignItems: 'center',
  },
  switchText: {
    color: 'white',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});