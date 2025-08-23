-- Create retrospectives table to store retrospective sessions
CREATE TABLE IF NOT EXISTS retrospectives (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT 'Retrospective Session',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_retrospectives_created_at ON retrospectives(created_at);
CREATE INDEX IF NOT EXISTS idx_retrospectives_active ON retrospectives(is_active);
