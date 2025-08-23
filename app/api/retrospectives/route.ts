import { type NextRequest, NextResponse } from "next/server"
import { sql, initializeDatabase } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()

    const { title } = await request.json()

    const result = await sql`
      INSERT INTO retrospectives (title)
      VALUES (${title || "Retrospective Session"})
      RETURNING id, title, created_at, is_active
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error creating retrospective:", error)
    return NextResponse.json({ error: "Failed to create retrospective" }, { status: 500 })
  }
}

export async function GET() {
  try {
    await initializeDatabase()

    const result = await sql`
      SELECT id, title, created_at, is_active
      FROM retrospectives
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 10
    `

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching retrospectives:", error)
    return NextResponse.json({ error: "Failed to fetch retrospectives" }, { status: 500 })
  }
}
