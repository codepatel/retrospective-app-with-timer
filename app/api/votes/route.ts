import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { feedback_item_id, device_id } = await request.json()

    if (!feedback_item_id) {
      return NextResponse.json({ error: "Feedback item ID is required" }, { status: 400 })
    }

    if (!device_id) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    const existingVote = await sql`
      SELECT id FROM votes 
      WHERE feedback_item_id = ${feedback_item_id} AND device_id = ${device_id}
    `

    if (existingVote.length > 0) {
      return NextResponse.json({ error: "You have already voted for this item" }, { status: 409 })
    }

    // Verify the feedback item exists
    const feedbackItem = await sql`
      SELECT id FROM feedback_items WHERE id = ${feedback_item_id}
    `

    if (feedbackItem.length === 0) {
      return NextResponse.json({ error: "Feedback item not found" }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO votes (feedback_item_id, device_id)
      VALUES (${feedback_item_id}, ${device_id})
      RETURNING id, feedback_item_id, created_at
    `

    // Get updated vote count
    const voteCount = await sql`
      SELECT COUNT(*) as count FROM votes WHERE feedback_item_id = ${feedback_item_id}
    `

    return NextResponse.json({
      vote: result[0],
      total_votes: Number.parseInt(voteCount[0].count),
    })
  } catch (error) {
    console.error("Error adding vote:", error)
    return NextResponse.json({ error: "Failed to add vote" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const feedbackItemId = searchParams.get("feedback_item_id")

    if (!feedbackItemId) {
      return NextResponse.json({ error: "Feedback item ID is required" }, { status: 400 })
    }

    const result = await sql`
      SELECT COUNT(*) as count FROM votes WHERE feedback_item_id = ${feedbackItemId}
    `

    return NextResponse.json({ vote_count: Number.parseInt(result[0].count) })
  } catch (error) {
    console.error("Error fetching vote count:", error)
    return NextResponse.json({ error: "Failed to fetch vote count" }, { status: 500 })
  }
}
