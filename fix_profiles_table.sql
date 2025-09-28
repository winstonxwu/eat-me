-- Fix Profiles Table Schema for Image Upload
-- Run this SQL in your Supabase SQL Editor

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  bio TEXT,
  profile_photo TEXT, -- Will store storage key (e.g., "avatars/user123-timestamp.jpg")
  likes TEXT[], -- Array of food preferences
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Add profile_photo column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_photo') THEN
        ALTER TABLE profiles ADD COLUMN profile_photo TEXT;
        RAISE NOTICE 'Added profile_photo column to profiles table';
    ELSE
        RAISE NOTICE 'profile_photo column already exists in profiles table';
    END IF;
END $$;

-- Add bio column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
        ALTER TABLE profiles ADD COLUMN bio TEXT;
        RAISE NOTICE 'Added bio column to profiles table';
    ELSE
        RAISE NOTICE 'bio column already exists in profiles table';
    END IF;
END $$;

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create or replace RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
FOR UPDATE USING (user_id = auth.uid());

-- Allow users to view profiles of their matches (for images in ForYou/matches screens)
DROP POLICY IF EXISTS "Users can view profiles of their matches" ON profiles;
CREATE POLICY "Users can view profiles of their matches" ON profiles
FOR SELECT USING (
  user_id = auth.uid() OR
  user_id IN (
    SELECT user_a FROM matches WHERE user_b = auth.uid()
    UNION
    SELECT user_b FROM matches WHERE user_a = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Verify table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Check existing data
SELECT COUNT(*) as total_profiles, COUNT(profile_photo) as profiles_with_photos
FROM profiles;