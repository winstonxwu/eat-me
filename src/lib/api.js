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

  try {
    const payload = {
      p_name: name ?? 'User',
      p_zipcode: Number.isInteger(zipcode) ? zipcode : null,
      p_likes: Array.isArray(likes) ? likes : [],
      p_dislikes: Array.isArray(dislikes) ? dislikes : [],
    };
    const { error } = await supabase.rpc('set_profile', payload);
    if (error) throw error;
  } catch (rpcError) {
    console.log('RPC set_profile failed, using fallback:', rpcError.message);

    // Fallback: Direct database operations
    const userName = name ?? 'User';
    const userZipcode = Number.isInteger(zipcode) ? zipcode : null;
    const userLikes = Array.isArray(likes) ? likes : [];
    const userDislikes = Array.isArray(dislikes) ? dislikes : [];

    // Update users_public table
    const { error: publicError } = await supabase
      .from('users_public')
      .upsert({
        user_id: user.id,
        name: userName,
        zipcode: userZipcode
      });

    if (publicError) {
      console.error('users_public upsert error:', publicError);
      throw publicError;
    }

    // Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        likes: userLikes,
        dislikes: userDislikes
      });

    if (profileError) {
      console.error('profiles upsert error:', profileError);
      throw profileError;
    }

    console.log('Fallback set_profile completed successfully');
  }
}

export async function getZipcodeMatches(zipcodeRange = 2, limit = 20) {
  try {
    const { data, error } = await supabase.rpc('zipcode_matches_with_likes', { p_limit: limit, p_zipcode_range: zipcodeRange });
    if (error) throw error;
    return data ?? [];
  } catch (rpcError) {
    console.log('RPC zipcode_matches_with_likes failed, using fallback:', rpcError.message);

    // Fallback: Get current user's zipcode first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: me } = await supabase
      .from('users_public')
      .select('zipcode')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!me?.zipcode) return [];

    const userZipcode = typeof me.zipcode === 'string' ? parseInt(me.zipcode) : me.zipcode;
    if (!Number.isInteger(userZipcode)) return [];

    // Get users within zipcode range
    const zipcodeMin = userZipcode - zipcodeRange;
    const zipcodeMax = userZipcode + zipcodeRange;

    const { data: users, error: usersError } = await supabase
      .from('users_public')
      .select('user_id, name, zipcode')
      .neq('user_id', user.id)
      .gte('zipcode', zipcodeMin)
      .lte('zipcode', zipcodeMax)
      .limit(limit);

    if (usersError) throw usersError;

    // Get their preferences
    const userIds = (users || []).map(u => u.user_id);
    let userLikes = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, likes')
        .in('user_id', userIds);

      for (const profile of profiles || []) {
        userLikes[profile.user_id] = profile.likes || [];
      }
    }

    return (users || []).map(u => ({
      target_user_id: u.user_id,
      name: u.name,
      zipcode: u.zipcode,
      likes: userLikes[u.user_id] || [],
      zipcode_diff: Math.abs(u.zipcode - userZipcode)
    }));
  }
}
export async function likeUser(targetUserId, isLike = true) {
  try {
    const { data, error } = await supabase.rpc('do_swipe', { p_target: targetUserId, p_is_like: isLike });
    if (error) throw error;
    const row = data?.[0] || { matched: false, match_id: null };
    return row;
  } catch (rpcError) {
    console.log('RPC do_swipe failed, using fallback:', rpcError.message);

    // Fallback: Manual swipe logic
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (!isLike) {
      // For dislikes, just record the swipe (no matching logic needed)
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        swiped_id: targetUserId,
        is_like: false
      });
      return { matched: false, match_id: null };
    }

    // For likes, record the swipe and check for mutual likes
    const { error: swipeError } = await supabase.from('swipes').insert({
      swiper_id: user.id,
      swiped_id: targetUserId,
      is_like: true
    });

    if (swipeError) throw swipeError;

    // Check if the other user already liked us
    const { data: mutualLike } = await supabase
      .from('swipes')
      .select('*')
      .eq('swiper_id', targetUserId)
      .eq('swiped_id', user.id)
      .eq('is_like', true)
      .maybeSingle();

    if (mutualLike) {
      // Create a match
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          user_a: user.id,
          user_b: targetUserId
        })
        .select('id')
        .single();

      if (matchError) throw matchError;

      return { matched: true, match_id: match.id };
    }

    return { matched: false, match_id: null };
  }
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
