import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Alert, TouchableOpacity, StyleSheet, Dimensions, Animated, PanResponder, Image } from 'react-native';
import { likeUser } from '../lib/api';
import { supabase } from '../utils/supabase';
import { getImagePublicUrl } from '../utils/imageUpload';

const { width, height } = Dimensions.get('window');

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

function normalizeTags(arr) {
  return Array.isArray(arr)
    ? arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : [];
}

function jaccard(aArr, bArr) {
  const A = new Set(normalizeTags(aArr));
  const B = new Set(normalizeTags(bArr));
  if (A.size === 0 && B.size === 0) return { score: 0, inter: [], uni: [] };
  const inter = [...A].filter((x) => B.has(x));
  const uni = new Set([...A, ...B]);
  return { score: inter.length / Math.max(1, uni.size), inter, uni: [...uni] };
}

export default function ForYouScreen({ navigation }) {
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userPreferences, setUserPreferences] = useState([]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [flippedCards, setFlippedCards] = useState(new Set());
  const [flipAnimations, setFlipAnimations] = useState(new Map());

  const panRef = useRef(new Animated.ValueXY());
  const rotateRef = useRef(new Animated.Value(0));
  const opacityRef = useRef(new Animated.Value(1));

  const pan = panRef.current;
  const rotate = rotateRef.current;
  const opacity = opacityRef.current;

  const ensureLocationAndLoad = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');

      // Try to get zipcode with retry mechanism for database consistency
      let zipcode = null;
      for (let i = 0; i < 3; i++) {
        const { data: me } = await supabase
          .from('users_public')
          .select('zipcode')
          .eq('user_id', user.id)
          .maybeSingle();

        let rawZipcode = me?.zipcode;
        if (typeof rawZipcode === 'string') {
          rawZipcode = parseInt(rawZipcode.trim());
        }

        if (Number.isInteger(rawZipcode) && rawZipcode >= 10000 && rawZipcode <= 99999) {
          zipcode = rawZipcode;
          break;
        }

        if (i < 2) await new Promise(r => setTimeout(r, 300));
      }

      if (!zipcode) {
        Alert.alert('Zipcode needed','Set your zipcode to find matches in your area.',
          [{ text:'Set now', onPress:()=>navigation.replace?.('LocationScreen') }]);
        setNearby([]); return;
      }

      // Try RPC function first, fallback to direct queries
      let near, myLikesArr;

      // Get existing matches first to exclude them from all queries
      const { data: existingMatches } = await supabase
        .from('matches')
        .select('user_a, user_b')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      // Collect all user IDs that current user has already matched with
      const alreadyMatchedIds = new Set([user.id]); // Always exclude self
      for (const match of existingMatches || []) {
        if (match.user_a === user.id) {
          alreadyMatchedIds.add(match.user_b);
        } else {
          alreadyMatchedIds.add(match.user_a);
        }
      }

      console.log('Already matched with user IDs:', Array.from(alreadyMatchedIds));

      // Get potential matches by zipcode
      try {
        const { data, error } = await supabase.rpc('zipcode_matches_with_likes', { p_limit: 20, p_zipcode_range: 2 });
        if (error) throw error;

        // Filter out already matched users from RPC results
        near = (data || []).filter(user => !alreadyMatchedIds.has(user.target_user_id));
        console.log(`Filtered RPC results: ${data?.length || 0} -> ${near.length} (excluded ${(data?.length || 0) - near.length} matched users)`);

        // Enrich RPC data with profile photos
        if (near && near.length > 0) {
          const userIds = near.map(u => u.target_user_id).filter(Boolean);
          console.log('🔍 RPC - Fetching profile photos for user IDs:', userIds);

          if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
              .from('profiles')
              .select('user_id, profile_photo')
              .in('user_id', userIds);

            console.log('📊 RPC - Profile photos query result:', {
              profiles,
              error: profilesError,
              count: profiles?.length || 0
            });

            const photoMap = {};
            for (const profile of profiles || []) {
              photoMap[profile.user_id] = profile.profile_photo;
              console.log(`👤 RPC - Profile photo for ${profile.user_id}:`, {
                profile_photo: profile.profile_photo,
                type: typeof profile.profile_photo,
                length: profile.profile_photo?.length || 0
              });
            }

            // Add profile photos to the user data with public URLs
            near = near.map(user => {
              const photoKey = photoMap[user.target_user_id];
              let photoUrl = null;

              console.log(`Processing photo for ${user.name}, photoKey:`, photoKey);

              if (photoKey) {
                try {
                  // First try the utility function
                  photoUrl = getImagePublicUrl(photoKey);
                  console.log(`✅ Generated URL for ${user.name}:`, photoUrl);
                } catch (error) {
                  console.log(`❌ Failed to generate URL for ${user.name}:`, error.message);

                  // Try direct Supabase approach as fallback
                  try {
                    const { data } = supabase.storage.from('profiles').getPublicUrl(photoKey);
                    photoUrl = data?.publicUrl;
                    console.log(`🔧 Direct Supabase URL for ${user.name}:`, photoUrl);
                  } catch (directError) {
                    console.log(`❌ Direct approach also failed for ${user.name}:`, directError.message);

                    // Last resort: if photoKey looks like a full URL already, use it directly
                    if (photoKey && (photoKey.startsWith('http://') || photoKey.startsWith('https://'))) {
                      photoUrl = photoKey;
                      console.log(`🌐 Using photoKey as direct URL for ${user.name}:`, photoUrl);
                    }
                  }
                }
              } else {
                console.log(`📷 No photo key for ${user.name}`);
              }

              return {
                ...user,
                profile_photo: photoUrl, // Only use actual user photos
                profile_photo_key: photoKey
              };
            });
          }
        }
      } catch (rpcError) {
        console.log('RPC zipcode_matches_with_likes failed, using fallback query:', rpcError.message);

        // Fallback: Get users within zipcode range manually
        const zipcodeMin = zipcode - 2;
        const zipcodeMax = zipcode + 2;

        const { data: users, error: usersError } = await supabase
          .from('users_public')
          .select('user_id, name, zipcode')
          .not('user_id', 'in', `(${Array.from(alreadyMatchedIds).join(',')})`) // Exclude matched users
          .gte('zipcode', zipcodeMin)
          .lte('zipcode', zipcodeMax)
          .limit(20);

        if (usersError) throw usersError;

        console.log('Found users in zipcode range:', users);

        if (users && users.length > 0) {
          // Get their preferences
          const userIds = users.map(u => u.user_id);
          let userLikes = {};

          console.log('🔍 Fallback - Fetching profiles for user IDs:', userIds);

          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, likes, profile_photo')
            .in('user_id', userIds);

          console.log('📊 Fallback - Profiles query result:', { profiles, profilesError, count: profiles?.length || 0 });

          for (const profile of profiles || []) {
            // Ensure likes is an array
            const profileLikes = Array.isArray(profile.likes) ? profile.likes : [];
            userLikes[profile.user_id] = {
              likes: profileLikes,
              profile_photo: profile.profile_photo
            };
            console.log(`👤 Fallback - Profile data for ${profile.user_id}:`, {
              likes: profileLikes,
              profile_photo: profile.profile_photo,
              photo_type: typeof profile.profile_photo,
              photo_length: profile.profile_photo?.length || 0
            });
          }

          // Format data to match RPC function output
          near = users.map(u => {
            const userProfile = userLikes[u.user_id] || { likes: [], profile_photo: null };
            const userPreferences = userProfile.likes || [];
            console.log(`Mapping user ${u.user_id} (${u.name}) with likes:`, userPreferences);

            let photoUrl = null;
            const photoKey = userProfile.profile_photo;

            console.log(`Fallback - Processing photo for ${u.name}, photoKey:`, photoKey);

            if (photoKey) {
              try {
                // First try the utility function
                photoUrl = getImagePublicUrl(photoKey);
                console.log(`✅ Fallback - Generated URL for ${u.name}:`, photoUrl);
              } catch (error) {
                console.log(`❌ Fallback - Failed to generate URL for ${u.name}:`, error.message);

                // Try direct Supabase approach as fallback
                try {
                  const { data } = supabase.storage.from('profiles').getPublicUrl(photoKey);
                  photoUrl = data?.publicUrl;
                  console.log(`🔧 Fallback - Direct Supabase URL for ${u.name}:`, photoUrl);
                } catch (directError) {
                  console.log(`❌ Fallback - Direct approach also failed for ${u.name}:`, directError.message);

                  // Last resort: if photoKey looks like a full URL already, use it directly
                  if (photoKey && (photoKey.startsWith('http://') || photoKey.startsWith('https://'))) {
                    photoUrl = photoKey;
                    console.log(`🌐 Fallback - Using photoKey as direct URL for ${u.name}:`, photoUrl);
                  }
                }
              }
            } else {
              console.log(`📷 Fallback - No photo key for ${u.name}`);
            }

            return {
              target_user_id: u.user_id,
              name: u.name,
              zipcode: u.zipcode,
              likes: userPreferences,
              profile_photo: photoUrl, // Only use actual user photos
              profile_photo_key: userProfile.profile_photo,
              zipcode_diff: Math.abs(u.zipcode - zipcode)
            };
          });

          console.log('Final fallback data:', near);
        } else {
          // No users found in database
          near = [];
          console.log('No users found in zipcode range');
        }
      }

      // Get current user's likes
      try {
        const { data, error } = await supabase.rpc('my_likes');
        if (error) throw error;
        myLikesArr = data;
      } catch (rpcError) {
        console.log('RPC my_likes failed, using fallback query:', rpcError.message);

        // Fallback: Get likes from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('likes')
          .eq('user_id', user.id)
          .maybeSingle();

        myLikesArr = profile?.likes || [];
      }

      console.log('Current user raw likes:', myLikesArr);
      const myLikes = normalizeTags(myLikesArr || []);
      console.log('Current user normalized likes:', myLikes);

      // Set user preferences for display
      setUserPreferences(myLikesArr || []);

      const rows = Array.isArray(near) ? near : [];
      const enriched = rows.map(r => {
        const otherUserLikes = normalizeTags(r.likes || []);
        const { score, inter } = jaccard(myLikes, otherUserLikes);
        console.log(`User ${r.name} profile data:`, {
          profile_photo: r.profile_photo,
          profile_photo_key: r.profile_photo_key,
          hasPhoto: !!r.profile_photo
        }); // Debug log
        return { ...r, score, commonLikes: inter };
      }).sort((a,b)=> (b.score-a.score) || ((a.zipcode_diff||1e9)-(b.zipcode_diff||1e9)));

      setNearby(enriched);
    } catch (e) {
      Alert.alert('Nearby error', e.message || String(e));
      setNearby([]);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => { ensureLocationAndLoad(); }, [ensureLocationAndLoad]);

  const onLike = async (row) => {
    try {
      const targetId = row.target_user_id || row.id;
      const res = await likeUser(targetId, true);
      // Removed "Matched!" popup - users can see matches in the Matches tab
    } catch (e) {
      Alert.alert('Like error', e.message || String(e));
    }
  };

  const onPass = () => {
    // Just advance to next card, no API call needed
  };

  const togglePreference = (categoryId) => {
    setUserPreferences(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const savePreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');

      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          likes: userPreferences,
        });

      if (error) throw error;

      Alert.alert('Success', 'Food preferences updated successfully!');
      setShowPreferences(false);
      // Reload matches with new preferences
      ensureLocationAndLoad();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save preferences');
    }
  };

  const handleLikeButton = () => {
    const currentUser = nearby[currentIndex];
    if (currentUser) {
      onLike(currentUser);
    }
    forceSwipe('right');
  };

  const handlePassButton = () => {
    onPass();
    forceSwipe('left');
  };

  const resetCard = () => {
    pan.setValue({ x: 0, y: 0 });
    rotate.setValue(0);
    opacity.setValue(1);
  };

  const nextCard = () => {
    setCurrentIndex(prev => prev + 1);
    resetCard();
    // Clear flipped cards and animations when moving to next
    setFlippedCards(new Set());
    setFlipAnimations(new Map());
  };

  const getOrCreateFlipAnimation = (cardId) => {
    if (!flipAnimations.has(cardId)) {
      setFlipAnimations(prev => {
        const newMap = new Map(prev);
        newMap.set(cardId, new Animated.Value(0));
        return newMap;
      });
    }
    return flipAnimations.get(cardId) || new Animated.Value(0);
  };

  const toggleCardFlip = (cardId) => {
    const isCurrentlyFlipped = flippedCards.has(cardId);

    // Get or create animation
    let flipAnimation = flipAnimations.get(cardId);
    if (!flipAnimation) {
      flipAnimation = new Animated.Value(0);
      setFlipAnimations(prev => new Map(prev).set(cardId, flipAnimation));
    }

    // Animate the flip
    Animated.spring(flipAnimation, {
      toValue: isCurrentlyFlipped ? 0 : 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Update the flipped state
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const forceSwipe = (direction) => {
    const x = direction === 'right' ? width + 100 : -width - 100;
    Animated.parallel([
      Animated.timing(pan.x, {
        toValue: x,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(rotate, {
        toValue: direction === 'right' ? 15 : -15,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      nextCard();
    });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only set pan responder if there's significant movement
      const minMoveDistance = 10;
      return Math.abs(gestureState.dx) > minMoveDistance || Math.abs(gestureState.dy) > minMoveDistance;
    },
    onPanResponderGrant: (evt, gestureState) => {
      // Store initial position for gesture detection
      pan.setOffset({
        x: pan.x._value,
        y: pan.y._value,
      });
    },
    onPanResponderMove: (event, gestureState) => {
      // Only animate if there's significant horizontal movement
      const minMoveDistance = 10;
      if (Math.abs(gestureState.dx) > minMoveDistance) {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        const rotation = gestureState.dx * 0.1;
        rotate.setValue(rotation);
      }
    },
    onPanResponderRelease: (event, gestureState) => {
      pan.flattenOffset();

      const swipeThreshold = 80;
      const totalMovement = Math.abs(gestureState.dx) + Math.abs(gestureState.dy);
      const tapThreshold = 15;

      // If minimal movement, treat as tap for card flip
      if (totalMovement < tapThreshold) {
        const currentUser = nearby[currentIndex];
        if (currentUser) {
          const cardId = currentUser.target_user_id || currentUser.id || currentIndex;
          toggleCardFlip(cardId);
        }

        // Reset card position
        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }),
          Animated.spring(rotate, {
            toValue: 0,
            useNativeDriver: false,
          }),
        ]).start();

        return;
      }

      // If significant horizontal movement, treat as swipe
      if (Math.abs(gestureState.dx) > swipeThreshold) {
        const direction = gestureState.dx > 0 ? 'right' : 'left';

        if (direction === 'right') {
          const currentUser = nearby[currentIndex];
          if (currentUser) {
            onLike(currentUser);
          }
        } else {
          onPass();
        }

        forceSwipe(direction);
      } else {
        // Not enough movement for swipe, spring back to center
        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }),
          Animated.spring(rotate, {
            toValue: 0,
            useNativeDriver: false,
          }),
        ]).start();
      }
    },
  });

  const Chip = ({ text }) => (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );

  const renderCard = (item, index) => {
    const percent = Math.round((item.score || 0) * 100);
    const isTopCard = index === currentIndex;
    const isSecondCard = index === currentIndex + 1;
    const cardId = item.target_user_id || item.id || index;
    const isFlipped = flippedCards.has(cardId);
    const flipAnimation = flipAnimations.get(cardId) || new Animated.Value(0);

    if (index < currentIndex) return null;
    if (index > currentIndex + 2) return null;

    const rotateStr = rotate.interpolate({
      inputRange: [-300, 0, 300],
      outputRange: ['-30deg', '0deg', '30deg'],
      extrapolate: 'clamp',
    });

    // Flip animation interpolations
    const frontRotateY = flipAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    const backRotateY = flipAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['180deg', '360deg'],
    });

    const frontOpacity = flipAnimation.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0, 0],
    });

    const backOpacity = flipAnimation.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0, 1],
    });

    const animatedStyle = isTopCard ? {
      transform: [
        ...pan.getTranslateTransform(),
        { rotate: rotateStr }
      ],
      opacity: opacity,
    } : {};

    return (
      <Animated.View
        key={cardId}
        style={[
          styles.card,
          isTopCard ? styles.topCard : isSecondCard ? styles.secondCard : styles.hiddenCard,
          animatedStyle
        ]}
        {...(isTopCard ? panResponder.panHandlers : {})}
      >
        <View style={styles.cardTouchable}>
          {/* Front of card */}
          <Animated.View
            style={[
              styles.cardFace,
              styles.cardFront,
              {
                opacity: frontOpacity,
                transform: [{ rotateY: frontRotateY }],
              },
            ]}
          >
            <View style={styles.cardContent}>
              <Text style={styles.userName}>
                {item.name || 'User'}
              </Text>
              <Text style={styles.similarity}>
                {percent}% match
              </Text>
              <View style={styles.photoContainer}>
                {item.profile_photo ? (
                  <Image
                    source={{ uri: item.profile_photo }}
                    style={styles.profilePhoto}
                    onError={(error) => {
                      console.log('❌ Profile image failed to load for user:', item.name);
                      console.log('Failed URL:', item.profile_photo);
                      console.log('Original key:', item.profile_photo_key);
                    }}
                    onLoad={() => {
                      console.log('✅ Profile image loaded successfully for user:', item.name);
                    }}
                  />
                ) : (
                  <View style={styles.placeholderPhoto}>
                    <Text style={styles.placeholderText}>📷</Text>
                  </View>
                )}
              </View>
              <View style={styles.tapHint}>
                <Text style={styles.tapHintText}>👆 Tap to see food preferences</Text>
              </View>
            </View>
          </Animated.View>

          {/* Back of card */}
          <Animated.View
            style={[
              styles.cardFace,
              styles.cardBack,
              {
                opacity: backOpacity,
                transform: [{ rotateY: backRotateY }],
              },
            ]}
          >
            <View style={styles.cardContent}>
              <View style={styles.backHeader}>
                <Text style={styles.backUserName}>
                  {item.name || 'User'}
                </Text>
                <Text style={styles.backSimilarity}>
                  {percent}% match
                </Text>
              </View>

              {item.commonLikes?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🤝 Common interests:</Text>
                  <View style={styles.chipContainer}>
                    {item.commonLikes.slice(0, 6).map((t, i) => (
                      <Chip key={`c-${cardId}-${t}-${i}`} text={`#${t}`} />
                    ))}
                  </View>
                </View>
              )}

              {item.likes?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🍽️ Their food preferences:</Text>
                  <View style={styles.chipContainer}>
                    {item.likes.slice(0, 8).map((t, i) => (
                      <Chip key={`l-${cardId}-${t}-${i}`} text={`#${t}`} />
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.tapHint}>
                <Text style={styles.tapHintText}>👆 Tap to go back</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {isTopCard && (
          <>
            <Animated.View
              style={[
                styles.swipeIndicator,
                styles.likeIndicator,
                {
                  opacity: pan.x.interpolate({
                    inputRange: [0, 150],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              <Text style={styles.likeText}>LIKE</Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.swipeIndicator,
                styles.passIndicator,
                {
                  opacity: pan.x.interpolate({
                    inputRange: [-150, 0],
                    outputRange: [1, 0],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              <Text style={styles.passText}>PASS</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    );
  };

  const currentUser = nearby[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Your Match</Text>
        <TouchableOpacity
          style={styles.preferencesButton}
          onPress={() => setShowPreferences(!showPreferences)}
        >
          <Text style={styles.preferencesButtonText}>
            {showPreferences ? '✕' : '⚙️'} Preferences
          </Text>
        </TouchableOpacity>
      </View>

      {showPreferences && (
        <View style={styles.preferencesSection}>
          <Text style={styles.preferencesTitle}>Your Food Preferences</Text>
          <Text style={styles.preferencesSubtitle}>
            Tap to select/deselect ({userPreferences.length} selected)
          </Text>
          <View style={styles.categoriesContainer}>
            {FOOD_CATEGORIES.map(category => {
              const isSelected = userPreferences.includes(category.id);
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryCard, isSelected && styles.selectedCard]}
                  onPress={() => togglePreference(category.id)}
                >
                  <Text style={styles.emoji}>{category.emoji}</Text>
                  <Text style={[styles.categoryName, isSelected && styles.selectedText]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={savePreferences}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && <Text style={styles.loading}>Loading...</Text>}

      {!showPreferences && (
        <>
          <View style={styles.cardStack}>
            {nearby.map((item, index) => renderCard(item, index))}

            {nearby.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No users found in your area</Text>
                <Text style={styles.emptySubtext}>
                  Try expanding your search radius or check back later for new users!
                </Text>
                <TouchableOpacity style={styles.refreshButton} onPress={ensureLocationAndLoad}>
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )}

            {currentIndex >= nearby.length && nearby.length > 0 && !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No more matches!</Text>
                <Text style={styles.emptySubtext}>
                  You've seen all users in your area. Check back later for new matches!
                </Text>
                <TouchableOpacity style={styles.refreshButton} onPress={ensureLocationAndLoad}>
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {currentUser && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.passButton} onPress={handlePassButton}>
                <Text style={styles.passButtonText}>←</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.likeButton} onPress={handleLikeButton}>
                <Text style={styles.likeButtonText}>→</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffb6c1',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  preferencesButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
  },
  preferencesButtonText: {
    color: '#ffb6c1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  preferencesSection: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  preferencesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  preferencesSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  categoryCard: {
    width: (width - 80) / 3,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    backgroundColor: '#ffb6c1',
    borderColor: '#ff8fa3',
  },
  emoji: {
    fontSize: 24,
    marginBottom: 5,
  },
  categoryName: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedText: {
    color: 'white',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#ffb6c1',
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  loading: {
    textAlign: 'center',
    color: 'white',
    fontSize: 16,
  },
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    position: 'absolute',
    width: width - 40,
    height: height * 0.6,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  topCard: {
    zIndex: 3,
    transform: [{ scale: 1 }],
  },
  secondCard: {
    zIndex: 2,
    transform: [{ scale: 0.95 }, { translateY: 10 }],
    opacity: 0.8,
  },
  hiddenCard: {
    zIndex: 1,
    transform: [{ scale: 0.9 }, { translateY: 20 }],
    opacity: 0.6,
  },
  cardTouchable: {
    flex: 1,
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    backgroundColor: 'white',
    borderRadius: 20,
  },
  cardBack: {
    backgroundColor: 'white',
    borderRadius: 20,
  },
  cardContent: {
    padding: 30,
    flex: 1,
  },
  photoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 12, // Square with rounded corners
    borderWidth: 3,
    borderColor: '#ffb6c1',
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 12, // Square with rounded corners
    borderWidth: 3,
    borderColor: '#ddd',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 40,
    opacity: 0.6,
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  userDistance: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  similarity: {
    fontSize: 20,
    color: '#ffb6c1',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ffb6c1',
    backgroundColor: '#fff0f3',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    color: '#ffb6c1',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 60,
    paddingBottom: 50,
  },
  passButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  passButtonText: {
    fontSize: 28,
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  likeButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  likeButtonText: {
    fontSize: 28,
    color: '#4ecdc4',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  refreshButton: {
    backgroundColor: 'white',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  refreshText: {
    color: '#ffb6c1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  swipeIndicator: {
    position: 'absolute',
    top: 50,
    borderWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  likeIndicator: {
    right: 30,
    borderColor: '#4ecdc4',
  },
  passIndicator: {
    left: 30,
    borderColor: '#ff6b6b',
  },
  likeText: {
    color: '#4ecdc4',
    fontSize: 24,
    fontWeight: 'bold',
  },
  passText: {
    color: '#ff6b6b',
    fontSize: 24,
    fontWeight: 'bold',
  },
  // Flip card styles
  backHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  backUserName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  backSimilarity: {
    fontSize: 18,
    color: '#ffb6c1',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tapHint: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: 15,
  },
  tapHintText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});