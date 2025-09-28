-- Create a database function to get shared preferences between matched users
-- This bypasses RLS issues by running as a security definer function
-- Run this in your Supabase SQL editor

CREATE OR REPLACE FUNCTION get_shared_preferences(p_match_id UUID)
RETURNS JSON AS $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
    v_likes_a JSONB;
    v_likes_b JSONB;
    v_result JSON;
BEGIN
    -- Get the match users
    SELECT user_a, user_b INTO v_user_a, v_user_b
    FROM matches
    WHERE id = p_match_id;

    IF v_user_a IS NULL THEN
        RETURN json_build_object(
            'error', 'Match not found',
            'shared_likes', '[]'::json
        );
    END IF;

    -- Get both users' preferences
    SELECT likes INTO v_likes_a
    FROM profiles
    WHERE user_id = v_user_a;

    SELECT likes INTO v_likes_b
    FROM profiles
    WHERE user_id = v_user_b;

    -- Build result
    v_result := json_build_object(
        'user_a', v_user_a,
        'user_b', v_user_b,
        'likes_a', COALESCE(v_likes_a, '[]'::jsonb),
        'likes_b', COALESCE(v_likes_b, '[]'::jsonb),
        'shared_likes', (
            SELECT json_agg(DISTINCT value)
            FROM (
                SELECT jsonb_array_elements_text(COALESCE(v_likes_a, '[]'::jsonb)) as value
                INTERSECT
                SELECT jsonb_array_elements_text(COALESCE(v_likes_b, '[]'::jsonb)) as value
            ) shared_values
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_shared_preferences(UUID) TO authenticated;