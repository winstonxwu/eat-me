-- Add content column to messages table if it doesn't exist
-- Run this in your Supabase SQL editor

DO $$
BEGIN
    -- Check if content column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'content') THEN
        -- Add the content column
        ALTER TABLE messages ADD COLUMN content TEXT;
        RAISE NOTICE 'Added content column to messages table';

        -- If there's existing data in encrypted_content, copy it to content
        UPDATE messages SET content = encrypted_content WHERE encrypted_content IS NOT NULL AND content IS NULL;
        RAISE NOTICE 'Copied encrypted_content to content column';
    ELSE
        RAISE NOTICE 'Content column already exists';
    END IF;
END $$;