-- Create votes table to track upvotes on feedback items
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  feedback_item_id INTEGER NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  voter_ip VARCHAR(45), -- Store IP address for anonymous voting
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(feedback_item_id, voter_ip) -- Prevent duplicate votes from same IP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_votes_feedback_item_id ON votes(feedback_item_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_ip ON votes(voter_ip);
