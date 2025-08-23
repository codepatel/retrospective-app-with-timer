import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const feedbackId = Number.parseInt(params.id)
    const { content } = await request.json()

    if (isNaN(feedbackId)) {
      return NextResponse.json({ error: "Invalid feedback ID" }, { status: 400 })
    }

    if (!content || content.trim() === "") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE feedback_items 
      SET content = ${content.trim()}, updated_at = NOW()
      WHERE id = ${feedbackId}
      RETURNING id, retrospective_id, category, content, author_name, created_at, updated_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Feedback item not found" }, { status: 404 })
    }

    // Get vote count for the updated item
    const voteResult = await sql`
      SELECT COUNT(*) as vote_count
      FROM votes
      WHERE feedback_item_id = ${feedbackId}
    `

    const feedbackItem = {
      ...result[0],
      vote_count: Number.parseInt(voteResult[0].vote_count),
    }

    return NextResponse.json(feedbackItem)
  } catch (error) {
    console.error("Error updating feedback item:", error)
    return NextResponse.json({ error: "Failed to update feedback item" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const feedbackId = Number.parseInt(params.id)

    if (isNaN(feedbackId)) {
      return NextResponse.json({ error: "Invalid feedback ID" }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM feedback_items 
      WHERE id = ${feedbackId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Feedback item not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting feedback item:", error)
    return NextResponse.json({ error: "Failed to delete feedback item" }, { status: 500 })
  }
}
