import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { supabase } from '../utils/supabase';

export default function MatchesScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in');
      const me = user.id;

      const { data: ms, error: e1 } = await supabase
        .from('matches')
        .select('id,user_a,user_b,created_at')
        .or(`user_a.eq.${me},user_b.eq.${me}`)
        .order('created_at', { ascending: false });
      if (e1) throw e1;

      const partnerIds = Array.from(
        new Set((ms || []).map(m => (m.user_a === me ? m.user_b : m.user_a)))
      );
      let namesMap = {};
      if (partnerIds.length) {
        const { data: ups, error: e2 } = await supabase
          .from('users_public')
          .select('user_id,name,lat,lng')
          .in('user_id', partnerIds);
        if (e2) throw e2;
        for (const u of ups || []) namesMap[u.user_id] = { name: u.name || 'User' };
      }

      const enriched = (ms || []).map(m => {
        const partner = m.user_a === me ? m.user_b : m.user_a;
        const display = namesMap[partner]?.name || 'User';
        return {
          id: m.id,
          partnerId: partner,
          name: display,
          created_at: m.created_at,
        };
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

  const openSuggest = (matchId, partnerName) => {
    navigation.navigate('SuggestionsScreen', { matchId, partnerName });
  };


  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>Match #{item.id}</Text>
      </View>
      <TouchableOpacity style={styles.btn} onPress={() => openSuggest(item.id, item.name)}>
        <Text style={styles.btnText}>Restaurants Nearby</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Matches</Text>
      {loading && <Text style={{ marginTop: 8 }}>Loading...</Text>}
      <FlatList
        style={{ marginTop: 12 }}
        data={rows}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        ListEmptyComponent={!loading ? <Text style={{ marginTop: 12 }}>No matches yet</Text> : null}
        onRefresh={load}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10
  },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, opacity: 0.6 },
  btn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginLeft: 12
  },
  btnText: { fontWeight: '600' },
});
