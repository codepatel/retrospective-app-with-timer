import { type NextRequest, NextResponse } from "next/server"
import { sql, initializeDatabase } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initializeDatabase()

    const isUUID = params.id.length === 36 && params.id.includes("-")

    const result = isUUID
      ? await sql`
          SELECT id, title, session_id, created_at, is_active, timer_enabled
          FROM retrospectives
          WHERE session_id = ${params.id} AND is_active = true
        `
      : await sql`
          SELECT id, title, session_id, created_at, is_active, timer_enabled
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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initializeDatabase()

    const { timer_enabled } = await request.json()

    if (typeof timer_enabled !== "boolean") {
      return NextResponse.json({ error: "timer_enabled must be a boolean" }, { status: 400 })
    }

    const result = await sql`
      UPDATE retrospectives 
      SET timer_enabled = ${timer_enabled}
      WHERE id = ${Number.parseInt(params.id)} AND is_active = true
      RETURNING id, title, session_id, created_at, is_active, timer_enabled
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Retrospective not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error updating retrospective:", error)
    return NextResponse.json({ error: "Failed to update retrospective" }, { status: 500 })
  }
}
