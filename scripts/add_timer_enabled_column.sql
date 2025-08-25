-- Add timer_enabled column to retrospectives table
ALTER TABLE retrospectives 
ADD COLUMN IF NOT EXISTS timer_enabled BOOLEAN DEFAULT FALSE;

-- Update existing retrospectives to have timer_enabled = false by default
UPDATE retrospectives 
SET timer_enabled = FALSE 
WHERE timer_enabled IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'retrospectives' 
AND column_name = 'timer_enabled';
