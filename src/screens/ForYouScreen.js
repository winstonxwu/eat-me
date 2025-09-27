import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, Alert } from 'react-native';
import { getNearby, likeUser } from '../lib/api';

export default function ForYouScreen() {
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ (async()=>{
    setLoading(true);
    try { setNearby(await getNearby(8000)); } 
    catch(e){ Alert.alert('Nearby error', e.message || String(e)); }
    finally { setLoading(false); }
  })(); }, []);

  const onLike = async (user) => {
    try {
      const res = await likeUser(user.target_user_id, true);
      if (res.matched) Alert.alert('Matched! 🎉', `Match #${res.match_id}`);
      else Alert.alert('Liked', 'waiting for like');
    } catch(e) {
      Alert.alert('Like error', e.message || String(e));
    }
  };

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'700' }}>For You</Text>
      {loading && <Text>Loading...</Text>}
      <FlatList
        style={{ marginTop:12 }}
        data={nearby}
        keyExtractor={(it)=>it.target_user_id}
        renderItem={({item})=>(
          <View style={{ borderWidth:1, borderRadius:12, padding:12, marginBottom:10 }}>
            <Text style={{ fontSize:16, fontWeight:'600' }}>{item.name}</Text>
            <Text>{Math.round(item.distance_m)} m away</Text>
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <Button title="Like" onPress={()=>onLike(item)} />
              {}
            </View>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text>noT_T</Text> : null}
      />
    </View>
  );
}
