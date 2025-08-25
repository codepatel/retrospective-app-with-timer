-- Add timer_remaining_time column to store remaining time when paused
ALTER TABLE retrospectives 
ADD COLUMN timer_remaining_time INTEGER DEFAULT 0;

-- Update existing paused timers to calculate their remaining time
UPDATE retrospectives 
SET timer_remaining_time = GREATEST(0, timer_duration - EXTRACT(EPOCH FROM (NOW() - timer_start_time))::INTEGER)
WHERE timer_is_paused = true AND timer_start_time IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'retrospectives' AND column_name = 'timer_remaining_time';
