-- Check what columns exist in the messages table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Show the actual table structure
\d messages;