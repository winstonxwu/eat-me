-- Enhanced Messaging System Database Schema
-- Run these commands in your Supabase SQL editor

-- Create chat_rooms table (may already exist)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) UNIQUE NOT NULL,
  encryption_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Simple messages table without encryption
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- text, image, location, date_plan
  created_at TIMESTAMP DEFAULT now(),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP, -- Soft delete
  metadata JSONB -- Additional data (image_url, location_data, etc.)
);

-- Add content column if table exists with encrypted_content
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'encrypted_content') THEN
        -- Add content column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'content') THEN
            ALTER TABLE messages ADD COLUMN content TEXT;
        END IF;
    END IF;
END $$;

-- Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  emoji VARCHAR(10) NOT NULL, -- 🔥, ❤️, 😂, 👍, etc.
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Typing indicators table (temporary data, auto-cleanup)
CREATE TABLE IF NOT EXISTS typing_indicators (
  match_id UUID REFERENCES matches(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

-- User presence table
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  last_seen TIMESTAMP DEFAULT now(),
  is_online BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT now()
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_receipts (
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  read_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_match ON typing_indicators(match_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence(is_online, last_seen);

-- RLS (Row Level Security) Policies

-- Chat rooms - users can only access their own match's chat room
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their match chat rooms" ON chat_rooms
  FOR ALL USING (
    match_id IN (
      SELECT id FROM matches
      WHERE user_a = auth.uid() OR user_b = auth.uid()
    )
  );

-- Messages - users can only see messages from their matches
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
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

-- Message reactions - users can react to messages in their matches
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage reactions in their matches" ON message_reactions
  FOR ALL USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN matches mt ON m.match_id = mt.id
      WHERE mt.user_a = auth.uid() OR mt.user_b = auth.uid()
    )
  );

-- Typing indicators - users can see typing in their matches
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage typing indicators in their matches" ON typing_indicators
  FOR ALL USING (
    match_id IN (
      SELECT id FROM matches
      WHERE user_a = auth.uid() OR user_b = auth.uid()
    )
  );

-- User presence - users can see presence of their matches
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view presence of their matches" ON user_presence
  FOR SELECT USING (
    user_id = auth.uid() OR
    user_id IN (
      SELECT user_a FROM matches WHERE user_b = auth.uid()
      UNION
      SELECT user_b FROM matches WHERE user_a = auth.uid()
    )
  );

CREATE POLICY "Users can update their own presence" ON user_presence
  FOR ALL USING (user_id = auth.uid());

-- Message receipts - users can manage read receipts for their messages
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage read receipts for their matches" ON message_receipts
  FOR ALL USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN matches mt ON m.match_id = mt.id
      WHERE mt.user_a = auth.uid() OR mt.user_b = auth.uid()
    )
  );

-- Functions for automatic cleanup and maintenance

-- Function to cleanup old typing indicators (called by cron job)
CREATE OR REPLACE FUNCTION cleanup_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators
  WHERE created_at < now() - interval '10 seconds';
END;
$$ LANGUAGE plpgsql;

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_presence (user_id, is_online, updated_at)
  VALUES (auth.uid(), true, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    is_online = true,
    last_seen = now(),
    updated_at = now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update presence on message send
CREATE OR REPLACE TRIGGER update_presence_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_user_presence();

-- Function to mark messages as delivered
CREATE OR REPLACE FUNCTION mark_messages_delivered(p_match_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET delivered_at = now()
  WHERE match_id = p_match_id
    AND sender_id != auth.uid()
    AND delivered_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for live updates
ALTER publication supabase_realtime ADD TABLE messages;
ALTER publication supabase_realtime ADD TABLE message_reactions;
ALTER publication supabase_realtime ADD TABLE typing_indicators;
ALTER publication supabase_realtime ADD TABLE user_presence;
ALTER publication supabase_realtime ADD TABLE message_receipts;