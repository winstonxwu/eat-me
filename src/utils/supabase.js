import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getDateSuggestions(matchId){
  const { data, error } = await supabase.functions.invoke('yelp_suggest', {
    body: { matchId }
  });
  if (error) throw error;
  return data;
}
