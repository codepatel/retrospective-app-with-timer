import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const retrospectiveId = Number.parseInt(params.id)

    if (isNaN(retrospectiveId)) {
      return NextResponse.json({ error: "Invalid retrospective ID" }, { status: 400 })
    }

    const result = await sql`
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
      ) v ON fi.id = v.feedback_item_id
      WHERE fi.retrospective_id = ${retrospectiveId}
      ORDER BY fi.created_at ASC
    `

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching feedback items:", error)
    return NextResponse.json({ error: "Failed to fetch feedback items" }, { status: 500 })
  }
}
