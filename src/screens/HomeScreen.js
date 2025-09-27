import React, { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView, Image } from 'react-native';
import { supabase } from '../utils/supabase';

export default function HomeScreen() {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('Name');
  const [lat, setLat] = useState('35.681236');
  const [lng, setLng] = useState('139.767125');
  const [likes, setLikes] = useState('ramen,sushi');
  const [dislikes, setDislikes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [log, setLog] = useState('');

  const logit = (x) => setLog((p) => p + (typeof x === 'string' ? x : JSON.stringify(x)) + '\n');

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    logit(error ? 'signUp error: ' + error.message : 'signUp ok');
  };
  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    logit(error ? 'signIn error: ' + error.message : 'signIn ok');
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    logit('signed out');
  };

  const saveProfile = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      logit('please sign in');
      return;
    }

    const { error: up1 } = await supabase.from('users_public').upsert({
      user_id: user.id,
      name,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });
    if (up1) {
      logit('users_public upsert error: ' + up1.message);
      return;
    }

    const { error: up2 } = await supabase.from('profiles').upsert({
      user_id: user.id,
      likes: likes.split(',').map((s) => s.trim()).filter(Boolean),
      dislikes: dislikes.split(',').map((s) => s.trim()).filter(Boolean),
    });
    if (up2) {
      logit('profiles upsert error: ' + up2.message);
      return;
    }

    logit('saved profile');
  };

  const loadProfile = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      logit('please sign in');
      return;
    }

    const { data: up, error: errUp } = await supabase
      .from('users_public')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (errUp) {
      logit('users_public select error: ' + errUp.message);
      return;
    }

    const { data: pr, error: errPr } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (errPr) {
      logit('profiles select error: ' + errPr.message);
      return;
    }

    if (up) {
      if (typeof up.name === 'string') setName(up.name);
      if (typeof up.lat !== 'undefined') setLat(String(up.lat));
      if (typeof up.lng !== 'undefined') setLng(String(up.lng));
    }
    if (pr) {
      if (Array.isArray(pr.likes)) setLikes(pr.likes.join(','));
      if (Array.isArray(pr.dislikes)) setDislikes(pr.dislikes.join(','));
      if (typeof pr.profile_photo === 'string') setPhotoUrl(pr.profile_photo);
    }

    logit({ users_public: up, profiles: pr });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Eat Me - test</Text>

      <Text>email</Text>
      <TextInput value={email} onChangeText={setEmail} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <Text>password</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Button title="SignUp" onPress={signUp} />
        <Button title="SignIn" onPress={signIn} />
        <Button title="SignOut" onPress={signOut} color="#b33" />
      </View>

      <Text style={{ marginTop: 16, fontWeight: '700' }}>Profile</Text>
      <TextInput value={name} onChangeText={setName} placeholder="name" style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={lat}
          onChangeText={setLat}
          placeholder="lat"
          keyboardType="numeric"
          style={{ flex: 1, borderWidth: 1, padding: 8, borderRadius: 8 }}
        />
        <TextInput
          value={lng}
          onChangeText={setLng}
          placeholder="lng"
          keyboardType="numeric"
          style={{ flex: 1, borderWidth: 1, padding: 8, borderRadius: 8 }}
        />
      </View>
      <TextInput value={likes} onChangeText={setLikes} placeholder="likes (comma)" style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <TextInput value={dislikes} onChangeText={setDislikes} placeholder="dislikes (comma)" style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Save Profile" onPress={saveProfile} />
        <Button title="Load Profile" onPress={loadProfile} />
      </View>

      {photoUrl ? (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Image source={{ uri: photoUrl }} style={{ width: 160, height: 160, borderRadius: 12 }} />
          <Text style={{ fontSize: 12, color: '#555', marginTop: 4 }} numberOfLines={1}>
            {photoUrl}
          </Text>
        </View>
      ) : null}

      <Text style={{ marginTop: 16, fontWeight: '700' }}>Logs</Text>
      <Text selectable style={{ borderWidth: 1, minHeight: 120, padding: 8, borderRadius: 8 }}>{log}</Text>
    </ScrollView>
  );
}
