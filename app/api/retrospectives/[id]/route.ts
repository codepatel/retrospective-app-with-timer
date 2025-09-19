import { type NextRequest, NextResponse } from "next/server"
import { sql, initializeDatabase } from "@/lib/db"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await initializeDatabase()

    const { id } = await context.params
    const isUUID = id.length === 36 && id.includes("-")
    const numericId = Number.parseInt(id, 10)

    const result = isUUID
      ? await sql`
          SELECT id, title, session_id, created_at, is_active, timer_enabled
          FROM retrospectives
          WHERE session_id = ${id} AND is_active = true
        `
      : await sql`
          SELECT id, title, session_id, created_at, is_active, timer_enabled
          FROM retrospectives
          WHERE id = ${numericId} AND is_active = true
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

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await initializeDatabase()

    const { timer_enabled } = await request.json()
    const { id } = await context.params
    const retrospectiveId = Number.parseInt(id, 10)

    if (typeof timer_enabled !== "boolean") {
      return NextResponse.json({ error: "timer_enabled must be a boolean" }, { status: 400 })
    }

    const result = await sql`
      UPDATE retrospectives
      SET timer_enabled = ${timer_enabled}
      WHERE id = ${retrospectiveId} AND is_active = true
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
