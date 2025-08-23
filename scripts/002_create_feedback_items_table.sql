-- Create feedback_items table to store individual feedback entries
CREATE TABLE IF NOT EXISTS feedback_items (
  id SERIAL PRIMARY KEY,
  retrospective_id INTEGER NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('what_went_right', 'what_can_improve', 'risks', 'resolutions')),
  content TEXT NOT NULL,
  author_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_items_retrospective_id ON feedback_items(retrospective_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_category ON feedback_items(category);
CREATE INDEX IF NOT EXISTS idx_feedback_items_created_at ON feedback_items(created_at);
