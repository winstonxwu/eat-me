import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import MapView, { Marker } from 'react-native-maps';

const CUISINE_MAP = {
  japanese: ['japanese','sushi','ramen','udon','izakaya'],
  chinese: ['chinese','noodles','dim_sum','dumpling'],
  korean: ['korean','korean_bbq'],
  italian: ['italian','pizza','pasta'],
  american: ['american','burger','steakhouse','fried_chicken'],
  mexican: ['mexican','taco','tacos','burrito'],
  thai: ['thai'],
  indian: ['indian','curry'],
  mediterranean: ['mediterranean','greek','turkish','lebanese'],
  french: ['french','bistro'],
  bbq: ['bbq','barbecue'],
  seafood: ['seafood'],
  vegetarian: ['vegetarian','veggie'],
  vegan: ['vegan'],
  dessert: ['dessert','ice_cream','cake','patisserie'],
  coffee: ['coffee','cafe'],
  pizza: ['pizza'],
  burger: ['burger','burgers'],
};
const normalizeLikes = (arr) =>
  Array.isArray(arr) ? arr.map(s => String(s).toLowerCase().trim().replace(/\s+/g,'_')) : [];
const cuisinePatternFromLikes = (likes) => {
  const t = new Set();
  const base = normalizeLikes(likes);
  base.forEach(k => (CUISINE_MAP[k] || [k]).forEach(x => t.add(x)));
  return Array.from(t).join('|');
};
const zip5 = (z) => String(z ?? '').match(/\d{5}/)?.[0] || null;

async function geocodeZip(zip) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&postalcode=${encodeURIComponent(zip)}`;
  const res = await fetch(url, { headers: { 'Accept-Language':'en', 'User-Agent':'eatme-app/1.0' }});
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const js = await res.json();
  if (!Array.isArray(js) || js.length === 0) return null;
  const p = js[0];
  return { lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
}

async function overpassByPoint(lat, lng, likes, radiusM = 4000) {
  const pattern = cuisinePatternFromLikes(likes);
  const makeQuery = (useCuisine) => `
    [out:json][timeout:25];
    (
      node["amenity"="restaurant"]${useCuisine && pattern ? `["cuisine"~"${pattern}",i]` : ''}(around:${radiusM},${lat},${lng});
      way["amenity"="restaurant"]${useCuisine && pattern ? `["cuisine"~"${pattern}",i]` : ''}(around:${radiusM},${lat},${lng});
      relation["amenity"="restaurant"]${useCuisine && pattern ? `["cuisine"~"${pattern}",i]` : ''}(around:${radiusM},${lat},${lng});
    );
    out center 40;
  `;
  const fetchQ = async (q) => {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type':'text/plain' },
      body: q
    });
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    return res.json();
  };
  let js = await fetchQ(makeQuery(true));
  let elems = Array.isArray(js?.elements) ? js.elements : [];
  if (elems.length === 0) {
    js = await fetchQ(makeQuery(false));
    elems = Array.isArray(js?.elements) ? js.elements : [];
  }
  const uniq = new Map();
  for (const el of elems) {
    const tags = el.tags || {};
    const name = tags.name || 'Restaurant';
    const cuisines = tags.cuisine ? tags.cuisine.split(';').map(s=>s.trim()) : [];
    const plat = el.lat ?? el.center?.lat ?? null;
    const plng = el.lon ?? el.center?.lon ?? null;
    const key = `${name}|${plat}|${plng}`;
    if (!uniq.has(key)) {
      uniq.set(key, {
        name,
        rating: null,
        price: null,
        lat: plat,
        lng: plng,
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        categories: cuisines,
        zipcode: null,
        source: 'osm'
      });
    }
  }
  return Array.from(uniq.values());
}

async function getZipsAndSharedLikes(matchId) {
  const out = { a: null, b: null, shared: [] };
  const { data: m } = await supabase.from('matches').select('user_a,user_b').eq('id', matchId).maybeSingle();
  if (!m) return out;
  const [{ data: ua }, { data: ub }] = await Promise.all([
    supabase.from('users_public').select('zipcode').eq('user_id', m.user_a).maybeSingle(),
    supabase.from('users_public').select('zipcode').eq('user_id', m.user_b).maybeSingle(),
  ]);
  out.a = zip5(ua?.zipcode);
  out.b = zip5(ub?.zipcode);
  try {
    const [{ data: pa }, { data: pb }] = await Promise.all([
      supabase.from('profiles').select('likes').eq('user_id', m.user_a).maybeSingle(),
      supabase.from('profiles').select('likes').eq('user_id', m.user_b).maybeSingle(),
    ]);
    const A = normalizeLikes(pa?.likes || []);
    const B = normalizeLikes(pb?.likes || []);
    out.shared = A.filter(x => B.includes(x));
  } catch {}
  return out;
}

export default function SuggestionsScreen({ route, navigation }) {
  const matchId = route.params?.matchId;
  const partnerName = route.params?.partnerName || 'Partner';

  const [items, setItems] = useState([]);
  const [zips, setZips] = useState(null);
  const [sharedLikes, setSharedLikes] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!matchId) { Alert.alert('Error', 'Missing matchId'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('osm_suggest', { body: { matchId } });
      if (!error && Array.isArray(data?.candidates) && data.candidates.length > 0) {
        setItems(data.candidates);
        setZips(data?.zips || null);
        setSharedLikes(Array.isArray(data?.sharedLikes) ? data.sharedLikes : []);
        setLoading(false);
        return;
      }
    } catch {}

    try {
      const { a, b, shared } = await getZipsAndSharedLikes(matchId);
      setZips({ a, b });
      const terms = shared.length ? shared : ['restaurant'];

      let results = [];
      if (a) {
        const p = await geocodeZip(a);
        if (p) results = results.concat(await overpassByPoint(p.lat, p.lng, terms, 4000));
      }
      if (b && b !== a) {
        const p2 = await geocodeZip(b);
        if (p2) results = results.concat(await overpassByPoint(p2.lat, p2.lng, terms, 4000));
      }

      setSharedLikes(shared);
      setItems(results.slice(0, 25));
      if (results.length === 0) Alert.alert('No restaurants found', 'Try adjusting tags or ZIP codes.');
    } catch (e) {
      Alert.alert('Suggest error', e.message || String(e));
      setItems([]);
      setZips(null);
      setSharedLikes([]);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  const openLink = (url) => { if (url) Linking.openURL(url); };
  const openMaps = (lat, lng, name, zipcode) => {
    let url;
    if (lat && lng) url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    else {
      const q = encodeURIComponent([name, zipcode].filter(Boolean).join(' '));
      url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }
    Linking.openURL(url);
  };

  const Chip = ({ text }) => (<View style={styles.chip}><Text style={styles.chipText}>{text}</Text></View>);

    const [showMap, setShowMap] = useState(true);

    const markers = items.filter(
    it => Number.isFinite(it?.lat) && Number.isFinite(it?.lng)
    );

    const region = React.useMemo(() => {
    if (markers.length === 0) {
        return { latitude: 39.8283, longitude: -98.5795, latitudeDelta: 20, longitudeDelta: 20 };
    }
    const lats = markers.map(m => m.lat);
    const lngs = markers.map(m => m.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const pad = 0.02;
    return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max((maxLat - minLat) * 1.4, pad),
        longitudeDelta: Math.max((maxLng - minLng) * 1.4, pad),
    };
    }, [markers]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>{item.categories?.slice(0, 3).join(' / ') || 'Restaurant'}</Text>
      </View>
      <View style={styles.btns}>
        <TouchableOpacity style={styles.btn} onPress={() => openLink(item.url)}>
          <Text style={styles.btnText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => openMaps(item.lat, item.lng, item.name, item.zipcode)}>
          <Text style={styles.btnText}>Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Restaurants for you & {partnerName}</Text>
      </View>
      {sharedLikes.length > 0 && (
        <View style={styles.sharedRow}>
          {sharedLikes.slice(0, 6).map((t) => <Chip key={t} text={`#${t}`} />)}
        </View>
      )}
      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
      {markers.length > 0 && (
  <View style={{ marginTop: 12 }}>
    <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
      <Text style={{ fontWeight:'600', color: 'white' }}>Map preview</Text>
      <TouchableOpacity
        onPress={() => setShowMap(s => !s)}
        style={{ paddingVertical:6, paddingHorizontal:10, borderWidth:1, borderRadius:8, borderColor: 'white' }}
      >
        <Text style={{ fontWeight:'600', color: 'white' }}>{showMap ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
    </View>

    {showMap && (
      <MapView
        style={styles.map}
        initialRegion={region}
        region={region}
      >
            {markers.map((m, i) => (
            <Marker
                key={`${m.name}-${i}`}
                coordinate={{ latitude: m.lat, longitude: m.lng }}
                title={m.name}
                description={(m.categories || []).slice(0,3).join(' / ')}
                onCalloutPress={() => {
                const url = m.url ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.name)}${
                    m.zipcode ? `%20${encodeURIComponent(m.zipcode)}` : ''
                    }`;
                Linking.openURL(url);
                }}
            />
            ))}
        </MapView>
        )}
    </View>
    )}

      <FlatList
        style={{ marginTop: 12 }}
        data={items}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        ListEmptyComponent={!loading ? <Text style={{ marginTop: 12, color: 'white', textAlign: 'center' }}>No suggestions yet</Text> : null}
        onRefresh={load}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, paddingTop: 60, backgroundColor: '#ffb6c1' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { marginRight: 16, padding: 8 },
  title: { fontSize: 20, fontWeight: '700', color: 'white', flex: 1 },
  subtitle: { marginTop: 4, opacity: 0.7, color: 'white' },
  sharedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, marginRight: 6, marginTop: 6 },
  chipText: { fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: 'white' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 2, opacity: 0.75 },
  btns: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  btn: { borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  btnText: { fontWeight: '600' },
  map: {
  marginTop: 8,
  width: '100%',
  height: 240,
  borderRadius: 12,
  borderWidth: 2,
  borderColor: 'white',
  overflow: 'hidden',
}
});
