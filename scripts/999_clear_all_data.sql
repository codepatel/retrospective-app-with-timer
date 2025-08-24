-- Database cleanup script for retrospective app
-- This script clears all data and resets sequences for a clean start

-- Disable foreign key checks temporarily (if needed)
-- Note: PostgreSQL doesn't have a global foreign key disable, so we'll delete in proper order

-- Delete data in reverse dependency order to avoid foreign key violations
DELETE FROM votes;
DELETE FROM feedback_items;
DELETE FROM retrospectives;

-- Reset sequences to start from 1
-- Get the sequence names and reset them
ALTER SEQUENCE retrospectives_id_seq RESTART WITH 1;
ALTER SEQUENCE feedback_items_id_seq RESTART WITH 1;
ALTER SEQUENCE votes_id_seq RESTART WITH 1;

-- Verification queries to confirm cleanup
SELECT 'retrospectives' as table_name, COUNT(*) as row_count FROM retrospectives
UNION ALL
SELECT 'feedback_items' as table_name, COUNT(*) as row_count FROM feedback_items
UNION ALL
SELECT 'votes' as table_name, COUNT(*) as row_count FROM votes;

-- Show current sequence values
SELECT 'retrospectives_id_seq' as sequence_name, last_value FROM retrospectives_id_seq
UNION ALL
SELECT 'feedback_items_id_seq' as sequence_name, last_value FROM feedback_items_id_seq
UNION ALL
SELECT 'votes_id_seq' as sequence_name, last_value FROM votes_id_seq;
