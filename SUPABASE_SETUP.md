# Supabase Storage Setup for Profile Photos

## Storage Bucket Configuration

To enable profile photo uploads, you need to create a storage bucket in your Supabase dashboard:

1. Go to your Supabase dashboard
2. Navigate to Storage
3. Create a new bucket named `profile-photos`
4. Set the bucket to be **public** (so profile photos can be displayed)

## Storage Policies

You'll also need to set up these RLS policies for the `profile-photos` bucket:

### Policy 1: Allow users to upload their own photos
```sql
-- Allow users to upload files to their own folder
INSERT policy:
- Name: `Users can upload their own profile photos`
- Allowed operation: `INSERT`
- Target roles: `authenticated`
- USING expression: `auth.uid()::text = (storage.foldername(name))[1]`

### Policy 2: Allow public read access
```sql
-- Allow anyone to view profile photos
SELECT policy:
- Name: `Public can view profile photos`
- Allowed operation: `SELECT`
- Target roles: `public`
- USING expression: `true`
```

### Policy 3: Allow users to update their own photos
```sql
-- Allow users to update their own profile photos
UPDATE policy:
- Name: `Users can update their own profile photos`
- Allowed operation: `UPDATE`
- Target roles: `authenticated`
- USING expression: `auth.uid()::text = (storage.foldername(name))[1]`
```

### Policy 4: Allow users to delete their own photos
```sql
-- Allow users to delete their own profile photos
DELETE policy:
- Name: `Users can delete their own profile photos`
- Allowed operation: `DELETE`
- Target roles: `authenticated`
- USING expression: `auth.uid()::text = (storage.foldername(name))[1]`
```

## Folder Structure

Photos will be stored in the following structure:
```
profile-photos/
  └── profiles/
      └── profile_[USER_ID]_[TIMESTAMP].jpg
```

This ensures each user can only access their own photos while allowing public viewing of all profile photos for the matching feature.