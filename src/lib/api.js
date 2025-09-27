import { supabase } from '../utils/supabase';

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return (await supabase.auth.getUser()).data.user;
}
export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function saveProfile({ name, zipcode, likes, dislikes }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const payload = {
    p_name: name ?? 'User',
    p_zipcode: Number.isInteger(zipcode) ? zipcode : null,
    p_likes: Array.isArray(likes) ? likes : [],
    p_dislikes: Array.isArray(dislikes) ? dislikes : [],
  };
  const { error } = await supabase.rpc('set_profile', payload);
  if (error) throw error;
}

export async function getZipcodeMatches(zipcodeRange = 2, limit = 20) {
  const { data, error } = await supabase.rpc('zipcode_matches_with_likes', { p_zipcode_range: zipcodeRange, p_limit: limit });
  if (error) throw error;
  return data ?? [];
}
export async function likeUser(targetUserId, isLike = true) {
  const { data, error } = await supabase.rpc('do_swipe', { p_target: targetUserId, p_is_like: isLike });
  if (error) throw error;
  const row = data?.[0] || { matched: false, match_id: null };
  return row;
}
export async function listMatches() {
  const me = (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase
    .from('matches')
    .select('id,user_a,user_b,created_at')
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
