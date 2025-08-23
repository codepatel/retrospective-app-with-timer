import { neon } from "@neondatabase/serverless"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}

export const sql = neon(process.env.DATABASE_URL)

let isInitialized = false

export async function initializeDatabase() {
  if (isInitialized) return

  try {
    await sql`DROP VIEW IF EXISTS feedback_items_with_votes`

    // Create retrospectives table
    await sql`
      CREATE TABLE IF NOT EXISTS retrospectives (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL DEFAULT 'Retrospective Session',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS feedback_items (
        id SERIAL PRIMARY KEY,
        retrospective_id INTEGER REFERENCES retrospectives(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        author_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    await sql`
      DO $$
      BEGIN
        -- Drop existing constraint if it exists
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'feedback_items_category_check' 
          AND table_name = 'feedback_items'
        ) THEN
          ALTER TABLE feedback_items DROP CONSTRAINT feedback_items_category_check;
        END IF;
        
        -- Add the constraint with correct values
        ALTER TABLE feedback_items 
        ADD CONSTRAINT feedback_items_category_check 
        CHECK (category IN ('what_went_right', 'what_can_improve', 'risks', 'resolutions'));
      END $$;
    `

    // Create votes table
    await sql`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        feedback_item_id INTEGER REFERENCES feedback_items(id) ON DELETE CASCADE,
        ip_address INET NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(feedback_item_id, ip_address)
      )
    `

    await sql`
      CREATE VIEW feedback_items_with_votes AS
      SELECT 
        fi.*,
        COALESCE(v.vote_count, 0) as vote_count
      FROM feedback_items fi
      LEFT JOIN (
        SELECT feedback_item_id, COUNT(*) as vote_count
        FROM votes
        GROUP BY feedback_item_id
      ) v ON fi.id = v.feedback_item_id
    `

    isInitialized = true
    console.log("[v0] Database tables initialized successfully")
  } catch (error) {
    console.error("[v0] Error initializing database:", error)
    throw error
  }
}
