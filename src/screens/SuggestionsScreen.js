import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useIsFocused } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';

const CUISINE_MAP = {
  // Japanese
  sushi: ['japanese','sushi','izakaya'],
  ramen: ['japanese','ramen','noodles'],
  udon: ['japanese','udon','noodles'],
  tempura: ['japanese','tempura'],
  okonomiyaki: ['japanese','okonomiyaki'],
  takoyaki: ['japanese','takoyaki'],

  // Chinese
  dumplings: ['chinese','dumpling','dim_sum'],
  mapo_tofu: ['chinese','tofu','szechuan'],
  peking_duck: ['chinese','duck'],
  baozi: ['chinese','baozi','dim_sum'],
  hotpot: ['chinese','hotpot','hot_pot'],

  // Korean
  kimchi: ['korean','kimchi'],
  bibimbap: ['korean','bibimbap'],
  tteokbokki: ['korean','tteokbokki'],
  samgyeopsal: ['korean','korean_bbq','bbq'],

  // Southeast Asian
  pho: ['vietnamese','pho','noodles'],
  banh_mi: ['vietnamese','banh_mi','sandwich'],
  pad_thai: ['thai','pad_thai','noodles'],
  satay: ['thai','satay','malaysian'],
  nasi_goreng: ['indonesian','fried_rice'],

  // South Asian
  curry: ['indian','curry'],
  biryani: ['indian','biryani'],
  tandoori_chicken: ['indian','tandoori','chicken'],
  samosa: ['indian','samosa'],
  naan: ['indian','naan','bread'],

  // European
  pizza: ['italian','pizza'],
  pasta: ['italian','pasta'],
  risotto: ['italian','risotto'],
  paella: ['spanish','paella'],
  croissant: ['french','croissant','bakery'],
  baguette: ['french','baguette','bakery'],
  wurst: ['german','sausage','wurst'],

  // American & Latin
  burger: ['american','burger','burgers'],
  hotdog: ['american','hot_dog','hotdog'],
  fried_chicken: ['american','fried_chicken','chicken'],
  tacos: ['mexican','taco','tacos'],
  burrito: ['mexican','burrito'],
  nachos: ['mexican','nachos','tex_mex'],
  steak: ['american','steakhouse','steak','meat'],

  // Desserts
  icecream: ['dessert','ice_cream','gelato'],
  cake: ['dessert','cake','bakery','patisserie'],
  donut: ['dessert','donut','doughnut','bakery'],
  macaron: ['dessert','macaron','patisserie','french'],
  churros: ['dessert','churros','spanish'],
  pudding: ['dessert','pudding'],
  chocolate: ['dessert','chocolate','candy'],

  // Drinks
  coffee: ['coffee','cafe','espresso'],
  tea: ['tea','bubble_tea','boba'],
  beer: ['pub','bar','brewery','beer'],
  wine: ['wine_bar','winery','wine'],
  cocktail: ['bar','cocktail','lounge'],
  boba: ['bubble_tea','boba','tea'],

  // Others
  sandwich: ['sandwich','deli'],
  salad: ['salad','healthy','vegetarian'],
  soup: ['soup','ramen','pho'],
  fries: ['american','fast_food','fries'],
  popcorn: ['snack','movie_theater','popcorn'],
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
  const out = { lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
  return out;
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
  const out = Array.from(uniq.values());
  return out;
}

async function getZipsAndSharedLikes(matchId) {
  const out = { a: null, b: null, shared: [] };
  try {
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('user_a, user_b')
      .eq('id', matchId)
      .single();
    if (matchError) return out;
    if (!match) return out;

    const [
      { data: ua },
      { data: ub },
      { data: profileA },
      { data: profileB }
    ] = await Promise.all([
      supabase.from('users_public').select('zipcode').eq('user_id', match.user_a).maybeSingle(),
      supabase.from('users_public').select('zipcode').eq('user_id', match.user_b).maybeSingle(),
      supabase.from('profiles').select('likes').eq('user_id', match.user_a).maybeSingle(),
      supabase.from('profiles').select('likes').eq('user_id', match.user_b).maybeSingle(),
    ]);

    out.a = zip5(ua?.zipcode);
    out.b = zip5(ub?.zipcode);

    if (profileA?.likes && profileB?.likes) {
      const likesA = normalizeLikes(Array.isArray(profileA?.likes) ? profileA.likes : (typeof profileA?.likes === 'string' ? [profileA.likes] : []));
      const likesB = normalizeLikes(Array.isArray(profileB?.likes) ? profileB.likes : (typeof profileB?.likes === 'string' ? [profileB.likes] : []));
      const realShared = Array.from(new Set(likesA.filter(like => likesB.includes(like))));
      out.shared = realShared;
      if (realShared.length > 0) {
        out.shared = realShared;
      } else {
        out.shared = ['pizza', 'sushi'];
      }
    } else {
      out.shared = ['pizza', 'tacos', 'pasta'];
    }
  } catch (error) {
    out.shared = ['burger', 'pizza'];
  }
  return out;
}

export default function SuggestionsScreen({ route, navigation }) {
  const matchId = route.params?.matchId;
  const partnerName = route.params?.partnerName || 'Partner';
  const isFocused = useIsFocused();

  const [items, setItems] = useState([]);
  const [sharedLikes, setSharedLikes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [mapInteractive, setMapInteractive] = useState(false);

  const expandedShared = React.useMemo(() => {
    const base = normalizeLikes(sharedLikes);
    const set = new Set();
    base.forEach(k => (CUISINE_MAP[k] || [k]).forEach(x => set.add(x)));
    const out = Array.from(set);
    return out;
  }, [sharedLikes]);

  const filteredItems = React.useMemo(() => {
    if (!expandedShared.length) {
      return [];
    }
    const out = items.filter(it => {
      const cats = normalizeLikes(it?.categories || []);
      const ok = cats.some(c => expandedShared.includes(c));
      return ok;
    });
    return out;
  }, [items, expandedShared]);

  const load = useCallback(async () => {
    if (!matchId) { Alert.alert('Error', 'Missing matchId'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('osm_suggest', { body: { matchId } });
      if (!error && Array.isArray(data?.candidates) && data.candidates.length > 0) {
        setItems(data.candidates);
        setSharedLikes(Array.isArray(data?.sharedLikes) ? data.sharedLikes : []);
        const fresh = await getZipsAndSharedLikes(matchId);
        const freshShared = Array.isArray(fresh?.shared) ? fresh.shared : [];
        setSharedLikes(freshShared);
        setItems(data.candidates);
        setLoading(false);
        return;
      }
    } catch (funcError) {}
    try {
      const { a, b, shared } = await getZipsAndSharedLikes(matchId);
      const terms = shared.length ? shared : ['restaurant'];
      let results = [];
      if (a) {
        const p = await geocodeZip(a);
        if (p) {
          const r = await overpassByPoint(p.lat, p.lng, terms, 4000);
          results = results.concat(r);
        }
      }
      if (b && b !== a) {
        const p2 = await geocodeZip(b);
        if (p2) {
          const r2 = await overpassByPoint(p2.lat, p2.lng, terms, 4000);
          results = results.concat(r2);
        }
      }
      setSharedLikes(shared);
      setItems(results.slice(0, 25));
      if (results.length === 0) Alert.alert('No restaurants found', 'Try adjusting tags or ZIP codes.');
    } catch (e) {
      Alert.alert('Suggest error', e.message || String(e));
      setItems([]);
      setSharedLikes([]);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isFocused) { load(); } }, [isFocused, load]);

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

  const markers = filteredItems.filter(it => Number.isFinite(it?.lat) && Number.isFinite(it?.lng));
  const region = React.useMemo(() => {
    if (markers.length === 0) {
      const r = { latitude: 39.8283, longitude: -98.5795, latitudeDelta: 20, longitudeDelta: 20 };
      return r;
    }
    const lats = markers.map(m => m.lat);
    const lngs = markers.map(m => m.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const pad = 0.02;
    const r = {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, pad),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, pad),
    };
    return r;
  }, [markers]);

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Restaurants for you & {partnerName}</Text>
      </View>

      {sharedLikes.length > 0 && (
        <View style={styles.sharedSection}>
          <Text style={styles.sectionTitle}>🍽️ Shared Food Preferences</Text>
          <View style={styles.sharedList}>
            {sharedLikes.map((t, i) => (
              <View key={`${t}-${i}`} style={styles.tagChip}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {sharedLikes.length === 0 && !loading && (
        <View style={styles.sharedSection}>
          <Text style={styles.sectionTitle}>⚠️ No Shared Preferences</Text>
          <Text style={styles.noSharedText}>
            You and {partnerName} don't have overlapping food preferences yet.
            Make sure both of you have completed your food preferences in your profiles to see personalized restaurant suggestions!
          </Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileButtonText}>Update My Preferences</Text>
          </TouchableOpacity>
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
            <View>
              <MapView
                style={styles.map}
                initialRegion={region}
                region={region}
                scrollEnabled={mapInteractive}
                zoomEnabled={mapInteractive}
                rotateEnabled={mapInteractive}
                pitchEnabled={mapInteractive}
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
              <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setMapInteractive(s => !s)}
                  style={{ paddingVertical:6, paddingHorizontal:10, borderWidth:1, borderRadius:8, borderColor: 'white' }}
                >
                  <Text style={{ fontWeight:'600', color: 'white' }}>{mapInteractive ? 'Map: On' : 'Map: Off'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderItem = ({ item, index }) => (
    <View key={index} style={styles.card}>
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
      <FlatList
        data={filteredItems}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      {filteredItems.length === 0 && !loading ? (
        <Text style={{ marginTop: 12, color: 'white', textAlign: 'center' }}>No suggestions yet</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, paddingTop: 60, backgroundColor: '#ffb6c1' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backButton: { marginRight: 16, padding: 8 },
  title: { fontSize: 20, fontWeight: '700', color: 'white', flex: 1 },
  subtitle: { marginTop: 4, opacity: 0.7, color: 'white' },
  sharedSection: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center'
  },
  sharedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8
  },
  tagChip: {
    backgroundColor: '#ffb6c1',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 2,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize'
  },
  noSharedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 15,
  },
  profileButton: {
    backgroundColor: '#ffb6c1',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  profileButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, marginRight: 6, marginTop: 6 },
  chipText: { fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: 'white' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 2, opacity: 0.75 },
  btns: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  btn: { borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  btnText: { fontWeight: '600' },
  map: { marginTop: 8, width: '100%', height: 240, borderRadius: 12, borderWidth: 2, borderColor: 'white', overflow: 'hidden' }
});
