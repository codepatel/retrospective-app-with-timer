-- Create a view to easily get vote counts for feedback items
CREATE OR REPLACE VIEW feedback_items_with_votes AS
SELECT 
  fi.*,
  COALESCE(v.vote_count, 0) as vote_count
FROM feedback_items fi
LEFT JOIN (
  SELECT 
    feedback_item_id,
    COUNT(*) as vote_count
  FROM votes
  GROUP BY feedback_item_id
) v ON fi.id = v.feedback_item_id;
