// utils/imageUpload.js
import { supabase } from './supabase';
import * as ImageManipulator from 'expo-image-manipulator';

const BUCKET = 'profiles';

async function bucketReady() {
  const { error } = await supabase.storage.from(BUCKET).list('', { limit: 1 });
  return { ok: !error, reason: error?.message };
}

export async function uploadImageToSupabase(localUri, userId, imagePickerMime) {
  if (!localUri) throw new Error('No image URI provided');
  if (!/^file:|^content:/.test(localUri)) throw new Error('Invalid local URI');

  const ready = await bucketReady();
  if (!ready.ok) throw new Error(`Bucket "${BUCKET}" not accessible: ${ready.reason || ''}`);

  let workUri = localUri;
  let contentType = 'image/jpeg';
  let ext = 'jpeg';

  if (imagePickerMime) {
    if (imagePickerMime === 'image/png') { contentType = 'image/png'; ext = 'png'; }
    else if (imagePickerMime === 'image/webp') { contentType = 'image/webp'; ext = 'webp'; }
    else { contentType = 'image/jpeg'; ext = 'jpeg'; }
  } else {
    if (/\.png$/i.test(localUri)) { contentType = 'image/png'; ext = 'png'; }
    else if (/\.webp$/i.test(localUri)) { contentType = 'image/webp'; ext = 'webp'; }
    else { contentType = 'image/jpeg'; ext = 'jpeg'; }
  }

  if (/\.heic$|\.heif$/i.test(localUri) || imagePickerMime === 'image/heic' || imagePickerMime === 'image/heif') {
    const manip = await ImageManipulator.manipulateAsync(localUri, [], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    workUri = manip.uri;
    contentType = 'image/jpeg';
    ext = 'jpeg';
  }

  // Read as ArrayBuffer (no Blob, no RN file object)
  const resp = await fetch(workUri);
  if (!resp.ok) throw new Error(`Read failed: ${resp.status}`);
  const ab = await resp.arrayBuffer();
  if (!ab || ab.byteLength === 0) throw new Error('ArrayBuffer empty (read failure)');
  if (ab.byteLength < 1024) throw new Error(`File too small (${ab.byteLength} bytes).`);

  const bytes = new Uint8Array(ab); // safest for upload

  const ts = Date.now();
  const fileName = `${ts}.${ext}`;
  const storageKey = `${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, bytes, { contentType, upsert: true, cacheControl: '3600' });

  if (error) {
    if (/bucket.*not.*found/i.test(error.message)) throw new Error(`Bucket "${BUCKET}" does not exist`);
    if (/policy|not allowed|permission/i.test(error.message)) {
      throw new Error('Upload blocked by RLS. Ensure key starts with auth.uid() and insert policy allows it.');
    }
    if (/mime|type.*not.*supported/i.test(error.message)) {
      throw new Error(`Bucket MIME whitelist mismatch. Ensure allowed_mime_types includes "${contentType}" or set it to NULL.`);
    }
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: url } = supabase.storage.from(BUCKET).getPublicUrl(storageKey);
  const publicUrl = url?.publicUrl ? `${url.publicUrl}?v=${ts}` : null;
  if (!publicUrl) throw new Error('Failed to generate public URL');

  return { storageKey, publicUrl };
}

export function getImagePublicUrl(storageKey) {
  if (!storageKey) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storageKey);
  return data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
}

export async function deleteImageFromSupabase(storageKey) {
  if (!storageKey) return false;
  const { error } = await supabase.storage.from(BUCKET).remove([storageKey]);
  return !error;
}
