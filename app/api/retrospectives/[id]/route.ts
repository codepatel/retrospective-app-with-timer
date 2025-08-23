import { type NextRequest, NextResponse } from "next/server"
import { sql, initializeDatabase } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initializeDatabase()

    const isUUID = params.id.length === 36 && params.id.includes("-")

    const result = isUUID
      ? await sql`
          SELECT id, title, session_id, created_at, is_active
          FROM retrospectives
          WHERE session_id = ${params.id} AND is_active = true
        `
      : await sql`
          SELECT id, title, session_id, created_at, is_active
          FROM retrospectives
          WHERE id = ${Number.parseInt(params.id)} AND is_active = true
        `

    if (result.length === 0) {
      return NextResponse.json({ error: "Retrospective not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error fetching retrospective:", error)
    return NextResponse.json({ error: "Failed to fetch retrospective" }, { status: 500 })
  }
}
