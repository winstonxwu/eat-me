import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'profiles';

export async function uploadImageToSupabase(localUri, objectPath) {
  if (!localUri) throw new Error('No image uri');

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  const arrayBuffer = decode(base64);

  const raw = String(objectPath || '').replace(/^\/+|\/+$/g, '');
  const firstSeg = raw.replace(/^profiles\//, '').split('/')[0] || 'uploads';

  const extFromUri = localUri.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  const ext = extFromUri === 'png' ? 'png' : extFromUri === 'heic' ? 'heic' : 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg';

  const filename = `${Date.now()}.${ext}`;
  const path = `${firstSeg}/${filename}`;

  const { error } = await supabase
    .storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}
