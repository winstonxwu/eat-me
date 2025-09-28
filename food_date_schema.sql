-- Food Date Calendar System Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Food date proposals table
CREATE TABLE IF NOT EXISTS food_date_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) NOT NULL,
  proposed_by UUID REFERENCES auth.users(id) NOT NULL,
  proposed_to UUID REFERENCES auth.users(id) NOT NULL,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  restaurant_yelp_id TEXT,
  restaurant_cuisine TEXT,
  restaurant_rating DECIMAL(2,1),
  restaurant_price_level INTEGER, -- 1-4 ($-$$$$)
  proposed_datetime TIMESTAMP NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'renegotiated', 'rejected', 'expired', 'cancelled')),
  created_at TIMESTAMP DEFAULT now(),
  responded_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (now() + INTERVAL '7 days') -- Auto-expire after 7 days
);

-- Confirmed food date events
CREATE TABLE IF NOT EXISTS food_date_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES food_date_proposals(id) NOT NULL,
  match_id UUID REFERENCES matches(id) NOT NULL,
  user_a UUID REFERENCES auth.users(id) NOT NULL,
  user_b UUID REFERENCES auth.users(id) NOT NULL,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  confirmed_datetime TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);

-- Counter-proposals for renegotiation
CREATE TABLE IF NOT EXISTS food_date_counter_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_proposal_id UUID REFERENCES food_date_proposals(id) NOT NULL,
  match_id UUID REFERENCES matches(id) NOT NULL,
  proposed_by UUID REFERENCES auth.users(id) NOT NULL,
  restaurant_name TEXT,
  restaurant_address TEXT,
  restaurant_yelp_id TEXT,
  proposed_datetime TIMESTAMP,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP DEFAULT now(),
  responded_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_food_date_proposals_match_id ON food_date_proposals(match_id);
CREATE INDEX IF NOT EXISTS idx_food_date_proposals_proposed_by ON food_date_proposals(proposed_by);
CREATE INDEX IF NOT EXISTS idx_food_date_proposals_proposed_to ON food_date_proposals(proposed_to);
CREATE INDEX IF NOT EXISTS idx_food_date_proposals_status ON food_date_proposals(status);
CREATE INDEX IF NOT EXISTS idx_food_date_proposals_datetime ON food_date_proposals(proposed_datetime);

CREATE INDEX IF NOT EXISTS idx_food_date_events_match_id ON food_date_events(match_id);
CREATE INDEX IF NOT EXISTS idx_food_date_events_datetime ON food_date_events(confirmed_datetime);
CREATE INDEX IF NOT EXISTS idx_food_date_events_status ON food_date_events(status);

-- Set up RLS (Row Level Security)
ALTER TABLE food_date_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_date_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_date_counter_proposals ENABLE ROW LEVEL SECURITY;

-- Food date proposals policies
DROP POLICY IF EXISTS "Users can view their food date proposals" ON food_date_proposals;
CREATE POLICY "Users can view their food date proposals" ON food_date_proposals
FOR SELECT USING (
  proposed_by = auth.uid() OR
  proposed_to = auth.uid()
);

DROP POLICY IF EXISTS "Users can create food date proposals" ON food_date_proposals;
CREATE POLICY "Users can create food date proposals" ON food_date_proposals
FOR INSERT WITH CHECK (
  proposed_by = auth.uid() AND
  match_id IN (
    SELECT id FROM matches
    WHERE user_a = auth.uid() OR user_b = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their food date proposals" ON food_date_proposals;
CREATE POLICY "Users can update their food date proposals" ON food_date_proposals
FOR UPDATE USING (
  proposed_by = auth.uid() OR proposed_to = auth.uid()
);

-- Food date events policies
DROP POLICY IF EXISTS "Users can view their food date events" ON food_date_events;
CREATE POLICY "Users can view their food date events" ON food_date_events
FOR SELECT USING (
  user_a = auth.uid() OR user_b = auth.uid()
);

DROP POLICY IF EXISTS "Users can create food date events" ON food_date_events;
CREATE POLICY "Users can create food date events" ON food_date_events
FOR INSERT WITH CHECK (
  user_a = auth.uid() OR user_b = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their food date events" ON food_date_events;
CREATE POLICY "Users can update their food date events" ON food_date_events
FOR UPDATE USING (
  user_a = auth.uid() OR user_b = auth.uid()
);

-- Counter-proposals policies
DROP POLICY IF EXISTS "Users can view counter proposals" ON food_date_counter_proposals;
CREATE POLICY "Users can view counter proposals" ON food_date_counter_proposals
FOR SELECT USING (
  match_id IN (
    SELECT id FROM matches
    WHERE user_a = auth.uid() OR user_b = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create counter proposals" ON food_date_counter_proposals;
CREATE POLICY "Users can create counter proposals" ON food_date_counter_proposals
FOR INSERT WITH CHECK (
  proposed_by = auth.uid() AND
  match_id IN (
    SELECT id FROM matches
    WHERE user_a = auth.uid() OR user_b = auth.uid()
  )
);

-- Function to auto-expire old proposals
CREATE OR REPLACE FUNCTION expire_old_food_date_proposals()
RETURNS void AS $$
BEGIN
  UPDATE food_date_proposals
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Function to create confirmed date event when proposal is accepted
CREATE OR REPLACE FUNCTION create_food_date_event_on_acceptance()
RETURNS trigger AS $$
BEGIN
  -- If proposal was just accepted, create the confirmed event
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO food_date_events (
      proposal_id,
      match_id,
      user_a,
      user_b,
      restaurant_name,
      restaurant_address,
      confirmed_datetime,
      status
    ) VALUES (
      NEW.id,
      NEW.match_id,
      NEW.proposed_by,
      NEW.proposed_to,
      NEW.restaurant_name,
      NEW.restaurant_address,
      NEW.proposed_datetime,
      'confirmed'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create events when proposals are accepted
DROP TRIGGER IF EXISTS create_event_on_proposal_acceptance ON food_date_proposals;
CREATE TRIGGER create_event_on_proposal_acceptance
  AFTER UPDATE ON food_date_proposals
  FOR EACH ROW
  EXECUTE FUNCTION create_food_date_event_on_acceptance();

-- Enable Realtime for live updates
ALTER publication supabase_realtime ADD TABLE food_date_proposals;
ALTER publication supabase_realtime ADD TABLE food_date_events;
ALTER publication supabase_realtime ADD TABLE food_date_counter_proposals;

-- Verify tables were created
SELECT 'SUCCESS: Food date tables created' as result
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'food_date_proposals'
);

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('food_date_proposals', 'food_date_events', 'food_date_counter_proposals')
ORDER BY table_name, ordinal_position;