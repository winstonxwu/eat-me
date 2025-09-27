import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Alert, TouchableOpacity, StyleSheet, Dimensions, Animated, PanResponder } from 'react-native';
import { getNearby, likeUser } from '../lib/api';
import { supabase } from '../utils/supabase';

const { width, height } = Dimensions.get('window');

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

  const pan = useRef(new Animated.ValueXY()).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const fetchLikesForUsers = async (userIds) => {
    if (!userIds.length) return {};
    const { data: pRows, error: pErr } = await supabase
      .from('profiles')
      .select('user_id, likes')
      .in('user_id', userIds);
    let map = {};
    if (!pErr && Array.isArray(pRows) && pRows.length) {
      for (const r of pRows) map[r.user_id] = normalizeTags(r.likes);
    }
    const missing = userIds.filter((id) => !map[id]);
    if (missing.length) {
      const { data: plRows, error: plErr } = await supabase
        .from('profile_likes')
        .select('user_id, tag')
        .in('user_id', missing);
      if (!plErr && Array.isArray(plRows)) {
        const agg = {};
        for (const r of plRows) {
          agg[r.user_id] = agg[r.user_id] || [];
          agg[r.user_id].push(r.tag);
        }
        for (const id of missing) map[id] = normalizeTags(agg[id] || []);
      }
    }
    return map;
  };

  const fetchMyLikes = async (myId) => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('likes')
      .eq('user_id', myId)
      .maybeSingle();
    let likes = normalizeTags(prof?.likes || []);
    if (likes.length === 0) {
      const { data: rows } = await supabase
        .from('profile_likes')
        .select('tag')
        .eq('user_id', myId);
      likes = normalizeTags((rows || []).map((r) => r.tag));
    }
    return likes;
  };

  const ensureLocationAndLoad = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');

      const { data: me } = await supabase
        .from('users_public')
        .select('lat,lng')
        .eq('user_id', user.id)
        .maybeSingle();
      const lat = typeof me?.lat === 'string' ? parseFloat(me.lat) : me?.lat;
      const lng = typeof me?.lng === 'string' ? parseFloat(me.lng) : me?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        Alert.alert('Location needed','Set your location to find nearby matches.',
          [{ text:'Set now', onPress:()=>navigation.replace?.('LocationScreen') }]);
        setNearby([]); return;
      }

      const { data: near, error: e1 } = await supabase.rpc('nearby_with_likes', { p_radius_m: 8000, p_limit: 20 });
      if (e1) throw e1;

      const { data: myLikesArr, error: e2 } = await supabase.rpc('my_likes');
      if (e2) throw e2;

      const myLikes = normalizeTags(myLikesArr || []);
      const rows = Array.isArray(near) ? near : [];

      const enriched = rows.map(r => {
        const { score, inter } = jaccard(myLikes, r.likes || []);
        return { ...r, score, commonLikes: inter };
      }).sort((a,b)=> (b.score-a.score) || ((a.distance_m||1e9)-(b.distance_m||1e9)));

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
      if (res.matched) Alert.alert('Matched! 🎉', `Match #${res.match_id}`);
      else Alert.alert('Liked', 'waiting for like');
    } catch (e) {
      Alert.alert('Like error', e.message || String(e));
    }
  };

  const onPass = () => {
    // Just advance to next card, no API call needed
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
    onPanResponderMove: (event, gestureState) => {
      pan.setValue({ x: gestureState.dx, y: gestureState.dy });

      // Calculate rotation based on horizontal movement
      const rotation = gestureState.dx * 0.1; // Adjust multiplier for sensitivity
      rotate.setValue(rotation);
    },
    onPanResponderRelease: (event, gestureState) => {
      const swipeThreshold = 120;

      if (Math.abs(gestureState.dx) > swipeThreshold) {
        // Swipe threshold reached - force complete the swipe
        const direction = gestureState.dx > 0 ? 'right' : 'left';

        if (direction === 'right') {
          // Like the user
          const currentUser = nearby[currentIndex];
          if (currentUser) {
            onLike(currentUser);
          }
        } else {
          // Pass on the user
          onPass();
        }

        forceSwipe(direction);
      } else {
        // Snap back to center
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

    if (index < currentIndex) return null; // Already swiped
    if (index > currentIndex + 2) return null; // Too far down the stack

    const rotateStr = rotate.interpolate({
      inputRange: [-300, 0, 300],
      outputRange: ['-30deg', '0deg', '30deg'],
      extrapolate: 'clamp',
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
        key={item.target_user_id || item.id || index}
        style={[
          styles.card,
          isTopCard ? styles.topCard : isSecondCard ? styles.secondCard : styles.hiddenCard,
          animatedStyle
        ]}
        {...(isTopCard ? panResponder.panHandlers : {})}
      >
        <View style={styles.cardContent}>
          <Text style={styles.userName}>
            {item.name || 'User'}
          </Text>
          <Text style={styles.userDistance}>
            {Math.round(item.distance_m)} meters away
          </Text>
          <Text style={styles.similarity}>
            {percent}% match
          </Text>

          {item.commonLikes?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Common interests:</Text>
              <View style={styles.chipContainer}>
                {item.commonLikes.slice(0, 6).map((t) => (
                  <Chip key={`c-${item.target_user_id}-${t}`} text={`#${t}`} />
                ))}
              </View>
            </View>
          )}

          {item.likes?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Their food preferences:</Text>
              <View style={styles.chipContainer}>
                {item.likes.slice(0, 8).map((t) => (
                  <Chip key={`l-${item.target_user_id}-${t}`} text={`#${t}`} />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Swipe indicators */}
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
            onPress={() => navigation.navigate('MatchesScreen')}
            style={{ position: 'absolute', right: 16, top: 60, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10, backgroundColor: '#fff' }}
          >
          <Text style={{ fontWeight: '600' }}>Matches</Text>
          </TouchableOpacity>
        </View>
      {loading && <Text style={styles.loading}>Loading...</Text>}

      <View style={styles.cardStack}>
        {nearby.map((item, index) => renderCard(item, index))}

        {currentIndex >= nearby.length && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No more matches!</Text>
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
  cardContent: {
    padding: 30,
    flex: 1,
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
    marginBottom: 20,
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
});
