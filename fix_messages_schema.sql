-- Fix Messages Table Schema
-- Run this in your Supabase SQL editor to fix the content column issue

-- First, check if the messages table exists and what columns it has
DO $$
DECLARE
    has_encrypted_content BOOLEAN := FALSE;
    has_content BOOLEAN := FALSE;
BEGIN
    -- Check if encrypted_content column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'encrypted_content'
    ) INTO has_encrypted_content;

    -- Check if content column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'content'
    ) INTO has_content;

    RAISE NOTICE 'Has encrypted_content: %', has_encrypted_content;
    RAISE NOTICE 'Has content: %', has_content;

    -- If we have encrypted_content but not content, add content column
    IF has_encrypted_content AND NOT has_content THEN
        RAISE NOTICE 'Adding content column to messages table';
        ALTER TABLE messages ADD COLUMN content TEXT;
    END IF;

    -- If we don't have either column, something is wrong with the table structure
    IF NOT has_encrypted_content AND NOT has_content THEN
        RAISE NOTICE 'Messages table is missing content columns, recreating table structure';

        -- Drop and recreate the messages table with proper structure
        DROP TABLE IF EXISTS messages CASCADE;

        CREATE TABLE messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            match_id UUID REFERENCES matches(id) NOT NULL,
            sender_id UUID REFERENCES auth.users(id) NOT NULL,
            content TEXT NOT NULL,
            message_type VARCHAR(20) DEFAULT 'text',
            created_at TIMESTAMP DEFAULT now(),
            delivered_at TIMESTAMP,
            read_at TIMESTAMP,
            edited_at TIMESTAMP,
            deleted_at TIMESTAMP,
            metadata JSONB
        );

        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

        -- Enable RLS
        ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

        -- Add RLS policies
        CREATE POLICY "Users can view messages from their matches" ON messages
          FOR SELECT USING (
            match_id IN (
              SELECT id FROM matches
              WHERE user_a = auth.uid() OR user_b = auth.uid()
            )
          );

        CREATE POLICY "Users can send messages to their matches" ON messages
          FOR INSERT WITH CHECK (
            sender_id = auth.uid() AND
            match_id IN (
              SELECT id FROM matches
              WHERE user_a = auth.uid() OR user_b = auth.uid()
            )
          );

        -- Enable realtime
        ALTER publication supabase_realtime ADD TABLE messages;

        RAISE NOTICE 'Messages table recreated successfully';
    END IF;

END $$;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';