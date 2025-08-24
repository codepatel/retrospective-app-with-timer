import { type NextRequest, NextResponse } from "next/server"
import { eventStore } from "@/lib/real-time-events"

// API endpoint for clients to poll for real-time events
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const retrospectiveId = Number.parseInt(params.id)
    const { searchParams } = new URL(request.url)
    const since = Number.parseInt(searchParams.get("since") || "0")

    if (isNaN(retrospectiveId)) {
      return NextResponse.json({ error: "Invalid retrospective ID" }, { status: 400 })
    }

    // Get events since the specified timestamp
    const events = eventStore.getEventsSince(retrospectiveId, since)
    const latestTimestamp = eventStore.getLatestTimestamp(retrospectiveId)

    return NextResponse.json({
      events,
      latest_timestamp: latestTimestamp,
      has_updates: events.length > 0,
    })
  } catch (error) {
    console.error("Events API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
