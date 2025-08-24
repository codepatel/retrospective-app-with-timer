import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("device_id")
    const retrospectiveId = searchParams.get("retrospective_id")

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    if (!retrospectiveId) {
      return NextResponse.json({ error: "Retrospective ID is required" }, { status: 400 })
    }

    const result = await sql`
      SELECT v.feedback_item_id 
      FROM votes v
      JOIN feedback_items f ON v.feedback_item_id = f.id
      WHERE v.device_id = ${deviceId} AND f.retrospective_id = ${retrospectiveId}
    `

    const votedItems = result.map((row) => row.feedback_item_id)

    return NextResponse.json({ voted_items: votedItems })
  } catch (error) {
    console.error("Error fetching user votes:", error)
    return NextResponse.json({ error: "Failed to fetch user votes" }, { status: 500 })
  }
}
