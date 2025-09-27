import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Button, Alert, TouchableOpacity } from 'react-native';
import { getNearby, likeUser } from '../lib/api';
import { supabase } from '../utils/supabase';

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

  const Chip = ({ text }) => (
    <View style={{
      borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, marginRight: 6, marginBottom: 6
    }}>
      <Text>{text}</Text>
    </View>
  );

  const renderItem = ({ item }) => {
    const percent = Math.round((item.score || 0) * 100);
    return (
      <View style={{ borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '700' }}>
          {item.name || 'User'} · {Math.round(item.distance_m)} m
        </Text>
        <Text style={{ marginTop: 4, opacity: 0.7 }}>Similarity: {percent}%</Text>

        {item.commonLikes?.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '600' }}>Common:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {item.commonLikes.slice(0, 6).map((t) => <Chip key={`c-${item.target_user_id}-${t}`} text={`#${t}`} />)}
            </View>
          </View>
        )}

        {item.likes?.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '600' }}>Their likes:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {item.likes.slice(0, 8).map((t) => <Chip key={`l-${item.target_user_id}-${t}`} text={`#${t}`} />)}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button title="Like" onPress={() => onLike(item)} />
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>For You</Text>
      {loading && <Text>Loading...</Text>}
      <FlatList
        style={{ marginTop: 12 }}
        data={nearby}
        keyExtractor={(it, idx) => String(it.target_user_id || it.id || idx)}
        renderItem={renderItem}
        ListEmptyComponent={!loading ? <Text style={{ marginTop: 12 }}>noT_T</Text> : null}
      />
    </View>
  );
}
