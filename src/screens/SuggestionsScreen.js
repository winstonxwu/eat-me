import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Linking, StyleSheet } from 'react-native';
import { supabase } from '../utils/supabase';

export default function SuggestionsScreen({ route, navigation }) {
  const matchId = route.params?.matchId;
  const partnerName = route.params?.partnerName || 'Partner';
  const [items, setItems] = useState([]);
  const [midpoint, setMidpoint] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
  if (!matchId) { Alert.alert('Error', 'Missing matchId'); return; }
  setLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke('yelp_suggest', {
      body: { matchId }
    });
    if (error) {
      throw { where: 'invoke', ...error };
    }
    if (!data || !Array.isArray(data.candidates)) {
      throw { where: 'payload', message: 'No candidates in response', data };
    }
    setItems(data.candidates);
    setMidpoint(data.midpoint || null);
  } catch (e) {
    Alert.alert(
      'Suggest error',
      JSON.stringify({
        where: e.where || 'unknown',
        status: e.status,
        name: e.name,
        message: e.message,
        context: e.context
      }, null, 2)
    );
    try {
      const { data: near } = await supabase.rpc('zipcode_matches_with_likes', { p_zipcode_range: 2, p_limit: 10 });
      const fallback = (near || []).map(r => ({
        name: `Near midpoint: ${r.name}`,
        rating: null, price: null,
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}`,
        lat: null, lng: null, categories: r.likes || []
      }));
      setItems(fallback);
      setMidpoint(null);
    } catch {
      setItems([]);
    }
  } finally {
    setLoading(false);
  }
}, [matchId]);
    

  useEffect(() => { load(); }, [load]);

  const openYelp = (url) => { if (url) Linking.openURL(url); };

  const openMaps = (lat, lng, name) => {
    if (!lat || !lng) return;
    const q = encodeURIComponent(name || 'Restaurant');
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${q}`;
    Linking.openURL(url);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          {item.categories?.slice(0,3).join(' / ') || 'Restaurant'}
        </Text>
        <Text style={styles.meta}>
          {item.price || ''}  {item.rating ? `⭐ ${item.rating}` : ''}
        </Text>
      </View>
      <View style={styles.btns}>
        <TouchableOpacity style={styles.btn} onPress={() => openYelp(item.url)}>
          <Text style={styles.btnText}>Yelp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => openMaps(item.lat, item.lng, item.name)}>
          <Text style={styles.btnText}>Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Restaurants for you & {partnerName}</Text>
      {midpoint && (
        <Text style={styles.subtitle}>
          midpoint: {midpoint.lat?.toFixed?.(4)}, {midpoint.lng?.toFixed?.(4)}
        </Text>
      )}
      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

      <FlatList
        style={{ marginTop: 12 }}
        data={items}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        ListEmptyComponent={!loading ? <Text style={{ marginTop: 12 }}>No suggestions yet</Text> : null}
        onRefresh={load}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 4, opacity: 0.7 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10
  },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 2, opacity: 0.75 },
  btns: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  btn: { borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  btnText: { fontWeight: '600' },
});
