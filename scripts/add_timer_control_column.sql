-- Add timer control tracking column to retrospectives table
ALTER TABLE retrospectives 
ADD COLUMN IF NOT EXISTS timer_controlled_by VARCHAR(255);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_retrospectives_timer_controlled_by 
ON retrospectives(timer_controlled_by);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'retrospectives' 
AND column_name = 'timer_controlled_by';
