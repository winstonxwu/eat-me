-- Complete Supabase Storage Fix for Profile Images
-- Run this SQL in your Supabase SQL Editor

-- STEP 1: Clean up any existing problematic policies
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;

-- STEP 2: Delete and recreate the bucket to ensure clean state
DELETE FROM storage.buckets WHERE id = 'profiles';

-- STEP 3: Create the profiles bucket with correct settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles',
  'profiles',
  true, -- Must be public for profile images
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/jpg', 'image/webp']
);

-- STEP 4: Set up comprehensive RLS policies for storage.objects
-- Allow authenticated users to upload their own profile images to avatars folder
CREATE POLICY "Authenticated users can upload profile images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profiles'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow everyone to view profile images (public read)
CREATE POLICY "Public can view profile images" ON storage.objects
FOR SELECT USING (bucket_id = 'profiles');

-- Allow authenticated users to update their own profile images
CREATE POLICY "Users can update own profile images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profiles'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow authenticated users to delete their own profile images
CREATE POLICY "Users can delete own profile images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profiles'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- STEP 5: Fix the profiles table structure
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  bio TEXT,
  profile_photo TEXT, -- Storage key like "avatars/user123-timestamp.jpg"
  likes TEXT[],
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Add missing columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- STEP 6: Set up RLS for profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (user_id = auth.uid());

-- Allow viewing profiles of matches (for displaying images)
DROP POLICY IF EXISTS "Users can view match profiles" ON profiles;
CREATE POLICY "Users can view match profiles" ON profiles
FOR SELECT USING (
  user_id = auth.uid() OR
  user_id IN (
    SELECT user_a FROM matches WHERE user_b = auth.uid()
    UNION
    SELECT user_b FROM matches WHERE user_a = auth.uid()
  )
);

-- STEP 7: Clean up any invalid profile_photo entries (old URLs that should be storage keys)
UPDATE profiles
SET profile_photo = NULL
WHERE profile_photo IS NOT NULL
  AND (profile_photo LIKE 'http%' OR profile_photo LIKE 'https%');

-- STEP 8: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- STEP 9: Verify everything is set up correctly
SELECT
  'Bucket Check' as test_type,
  COUNT(*) as count,
  'Should be 1' as expected
FROM storage.buckets WHERE name = 'profiles'

UNION ALL

SELECT
  'Profiles Table Columns' as test_type,
  COUNT(*) as count,
  'Should be 7+' as expected
FROM information_schema.columns
WHERE table_name = 'profiles'

UNION ALL

SELECT
  'Storage Policies' as test_type,
  COUNT(*) as count,
  'Should be 4' as expected
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%profile%'

UNION ALL

SELECT
  'Profiles Policies' as test_type,
  COUNT(*) as count,
  'Should be 4' as expected
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public';

-- STEP 10: Show current bucket configuration
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'profiles';

-- Show profiles table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;