import { type NextRequest, NextResponse } from "next/server"
import { sql, initializeDatabase } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()

    const { retrospective_id, category, content, author_name } = await request.json()

    console.log("[v0] Feedback creation request:", { retrospective_id, category, content, author_name })

    // Validate required fields
    if (!retrospective_id || !category || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate category
    const validCategories = ["what_went_right", "what_can_improve", "risks", "resolutions"]
    if (!validCategories.includes(category)) {
      console.log("[v0] Invalid category received:", category, "Valid categories:", validCategories)
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    console.log("[v0] Category validation passed, inserting into database")

    const result = await sql`
      INSERT INTO feedback_items (retrospective_id, category, content, author_name)
      VALUES (${retrospective_id}, ${category}, ${content}, ${author_name || null})
      RETURNING id, retrospective_id, category, content, author_name, created_at, updated_at
    `

    // Add vote_count: 0 for consistency with the frontend
    const feedbackItem = { ...result[0], vote_count: 0 }

    return NextResponse.json(feedbackItem)
  } catch (error) {
    console.error("[v0] Error creating feedback item:", error)
    return NextResponse.json({ error: "Failed to create feedback item" }, { status: 500 })
  }
}
