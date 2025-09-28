import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Image } from 'react-native';
import { supabase } from '../utils/supabase';
import { getImagePublicUrl } from '../utils/imageUpload';

// Helper function to normalize and compare food preferences
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

export default function MatchesScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');
      const me = user.id;

      // Get matches
      const { data: ms, error: e1 } = await supabase
        .from('matches')
        .select('id,user_a,user_b,created_at')
        .or(`user_a.eq.${me},user_b.eq.${me}`)
        .order('created_at', { ascending: false });
      if (e1) throw e1;

      if (!ms || ms.length === 0) {
        setRows([]);
        return;
      }

      const partnerIds = Array.from(
        new Set(ms.map(m => (m.user_a === me ? m.user_b : m.user_a)))
      );

      // Get partner names and zipcodes
      let namesMap = {};
      if (partnerIds.length) {
        const { data: ups, error: e2 } = await supabase
          .from('users_public')
          .select('user_id,name,zipcode')
          .in('user_id', partnerIds);
        if (e2) throw e2;
        for (const u of ups || []) {
          namesMap[u.user_id] = { name: u.name || 'User', zipcode: u.zipcode };
        }
      }

      // Get last message time for each match
      let lastMessageMap = {};
      if (ms.length) {
        const matchIds = ms.map(m => m.id);
        const { data: messages } = await supabase
          .from('messages')
          .select('match_id, created_at')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false });

        for (const msg of messages || []) {
          if (!lastMessageMap[msg.match_id]) {
            lastMessageMap[msg.match_id] = msg.created_at;
          }
        }
      }

      // Get current user's food preferences
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('likes')
        .eq('user_id', me)
        .maybeSingle();

      const myLikes = normalizeTags(myProfile?.likes || []);

      // Get partner food preferences and profile photos for match calculation
      let partnerLikesMap = {};
      let partnerPhotosMap = {};
      if (partnerIds.length) {
        const { data: partnerProfiles } = await supabase
          .from('profiles')
          .select('user_id, likes, profile_photo')
          .in('user_id', partnerIds);

        for (const profile of partnerProfiles || []) {
          partnerLikesMap[profile.user_id] = normalizeTags(profile.likes || []);
          // Generate public URL for profile photo if it exists
          if (profile.profile_photo) {
            partnerPhotosMap[profile.user_id] = getImagePublicUrl(profile.profile_photo);
          }
        }
      }

      // Enrich matches with all data
      const enriched = ms.map(m => {
        const partner = m.user_a === me ? m.user_b : m.user_a;
        const partnerInfo = namesMap[partner] || {};
        const partnerLikes = partnerLikesMap[partner] || [];
        const { score } = jaccard(myLikes, partnerLikes);
        const matchPercent = Math.round(score * 100);

        return {
          id: m.id,
          partnerId: partner,
          name: partnerInfo.name || 'User',
          zipcode: partnerInfo.zipcode,
          created_at: m.created_at,
          lastMessageTime: lastMessageMap[m.id] || null,
          matchPercent: matchPercent,
          hasMessages: !!lastMessageMap[m.id],
          profilePhotoUrl: partnerPhotosMap[partner] || null
        };
      });

      // Sort by last message time (most recent first), then by match percentage (highest first)
      enriched.sort((a, b) => {
        // If both have messages, sort by last message time
        if (a.hasMessages && b.hasMessages) {
          return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        }

        // If only one has messages, prioritize the one with messages
        if (a.hasMessages && !b.hasMessages) return -1;
        if (!a.hasMessages && b.hasMessages) return 1;

        // If neither has messages, sort by match percentage
        return b.matchPercent - a.matchPercent;
      });

      setRows(enriched);
    } catch (e) {
      Alert.alert('Load error', e.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Update current time every minute for accurate "time ago" display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const openSuggest = (matchId, partnerName, partnerId) => {
    navigation.navigate('FoodDateScreen', {
      matchId,
      partnerName,
      partnerId
    });
  };


  const openChat = (matchId, partnerName, partnerId) => {
    navigation.navigate('ChatScreen', { matchId, partnerName, partnerId });
  };

  // Function to calculate accurate "time ago" text
  const getTimeAgoText = (lastMessageTime) => {
    if (!lastMessageTime) return '';

    const lastTime = new Date(lastMessageTime);
    const now = currentTime;
    const diffMs = now - lastTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 2) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return lastTime.toLocaleDateString();
    }
  };

  const renderItem = ({ item }) => {
    // Format last message time using the real-time updating function
    const lastMessageText = item.hasMessages ? getTimeAgoText(item.lastMessageTime) : '';

    return (
      <View style={[styles.card, item.hasMessages && styles.cardWithMessages]}>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.matchPercent}>{item.matchPercent}% match</Text>
          </View>

          {/* Profile Picture */}
          {item.profilePhotoUrl ? (
            <View style={styles.profilePictureContainer}>
              <Image
                source={{ uri: item.profilePhotoUrl }}
                style={styles.profilePicture}
                onError={(error) => {
                  console.log('Profile image failed to load:', error);
                }}
              />
            </View>
          ) : (
            <View style={[styles.profilePictureContainer, styles.placeholderContainer]}>
              <Text style={styles.placeholderText}>📷</Text>
            </View>
          )}

          <Text style={styles.meta}>
            {item.hasMessages
              ? `💬 Last chat: ${lastMessageText}`
              : '📱 No messages yet'
            }
          </Text>

          {item.zipcode && <Text style={styles.zipcode}>📍 {item.zipcode}</Text>}
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.btn, styles.chatBtn]}
            onPress={() => openChat(item.id, item.name, item.partnerId)}
          >
            <Text style={[styles.btnText, styles.chatBtnText]}>💬 Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => openSuggest(item.id, item.name, item.partnerId)}>
            <Text style={styles.btnText}>🍽️ Eat</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Matches</Text>
      {loading && <Text style={{ marginTop: 8, color: 'white', textAlign: 'center' }}>Loading...</Text>}
      <FlatList
        style={{ marginTop: 12 }}
        data={rows}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        ListEmptyComponent={!loading ? <Text style={{ marginTop: 12, color: 'white', textAlign: 'center' }}>No matches yet</Text> : null}
        onRefresh={load}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, paddingTop: 60, backgroundColor: '#ffb6c1' },
  title: { fontSize: 22, fontWeight: '700', color: 'white' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    backgroundColor: 'white',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardWithMessages: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50', // Green accent for matches with messages
    backgroundColor: '#f8fff8', // Slight green tint
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  matchPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffb6c1',
    backgroundColor: '#fff0f3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  meta: {
    marginTop: 2,
    opacity: 0.8,
    fontSize: 13,
    color: '#555',
  },
  zipcode: {
    marginTop: 3,
    opacity: 0.7,
    fontSize: 12,
    color: '#666'
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 15,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffb6c1',
  },
  btnText: {
    fontWeight: '600',
    color: '#ff6b8b',
  },
  chatBtn: {
    backgroundColor: '#ffb6c1',
    borderColor: '#ffb6c1',
  },
  chatBtnText: {
    color: 'white',
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  profilePicture: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#ffb6c1',
  },
  placeholderContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
    opacity: 0.6,
  },
});
