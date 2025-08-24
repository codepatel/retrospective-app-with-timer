import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// Server-side timer management
const activeTimers = new Map<number, NodeJS.Timeout>()

interface TimerState {
  id: number
  duration: number
  start_time: Date | null
  is_running: boolean
  is_paused: boolean
  remaining_time: number
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const retrospectiveId = Number.parseInt(params.id)

    if (isNaN(retrospectiveId)) {
      return NextResponse.json({ error: "Invalid retrospective ID" }, { status: 400 })
    }

    // Get timer state from database
    const result = await sql`
      SELECT 
        id,
        timer_duration,
        timer_start_time,
        timer_is_running,
        timer_is_paused
      FROM retrospectives 
      WHERE id = ${retrospectiveId} AND is_active = true
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Retrospective not found" }, { status: 404 })
    }

    const retrospective = result[0]
    let remainingTime = 0

    // Calculate remaining time if timer is running
    if (retrospective.timer_is_running && retrospective.timer_start_time && !retrospective.timer_is_paused) {
      const startTime = new Date(retrospective.timer_start_time)
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      remainingTime = Math.max(0, retrospective.timer_duration - elapsed)

      // If timer has expired, update database
      if (remainingTime === 0) {
        await sql`
          UPDATE retrospectives 
          SET timer_is_running = false, timer_is_paused = false
          WHERE id = ${retrospectiveId}
        `
        // Clear server-side timer
        if (activeTimers.has(retrospectiveId)) {
          clearTimeout(activeTimers.get(retrospectiveId)!)
          activeTimers.delete(retrospectiveId)
        }
      }
    } else if (retrospective.timer_is_paused && retrospective.timer_start_time) {
      // For paused timers, calculate remaining time at pause point
      const startTime = new Date(retrospective.timer_start_time)
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      remainingTime = Math.max(0, retrospective.timer_duration - elapsed)
    } else {
      remainingTime = retrospective.timer_duration || 0
    }

    const timerState: TimerState = {
      id: retrospective.id,
      duration: retrospective.timer_duration || 0,
      start_time: retrospective.timer_start_time,
      is_running: retrospective.timer_is_running || false,
      is_paused: retrospective.timer_is_paused || false,
      remaining_time: remainingTime,
    }

    return NextResponse.json(timerState)
  } catch (error) {
    console.error("Timer GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const retrospectiveId = Number.parseInt(params.id)
    const { action, duration } = await request.json()

    if (isNaN(retrospectiveId)) {
      return NextResponse.json({ error: "Invalid retrospective ID" }, { status: 400 })
    }

    // Verify retrospective exists
    const retrospectiveCheck = await sql`
      SELECT id FROM retrospectives WHERE id = ${retrospectiveId} AND is_active = true
    `

    if (retrospectiveCheck.length === 0) {
      return NextResponse.json({ error: "Retrospective not found" }, { status: 404 })
    }

    switch (action) {
      case "start":
        if (!duration || duration <= 0) {
          return NextResponse.json({ error: "Valid duration required" }, { status: 400 })
        }

        // Start timer
        await sql`
          UPDATE retrospectives 
          SET 
            timer_duration = ${duration},
            timer_start_time = NOW(),
            timer_is_running = true,
            timer_is_paused = false
          WHERE id = ${retrospectiveId}
        `

        // Set server-side timer to auto-stop when duration expires
        if (activeTimers.has(retrospectiveId)) {
          clearTimeout(activeTimers.get(retrospectiveId)!)
        }

        const timeout = setTimeout(async () => {
          await sql`
            UPDATE retrospectives 
            SET timer_is_running = false, timer_is_paused = false
            WHERE id = ${retrospectiveId}
          `
          activeTimers.delete(retrospectiveId)
        }, duration * 1000)

        activeTimers.set(retrospectiveId, timeout)
        break

      case "pause":
        await sql`
          UPDATE retrospectives 
          SET timer_is_paused = true
          WHERE id = ${retrospectiveId} AND timer_is_running = true
        `

        // Clear server-side timer
        if (activeTimers.has(retrospectiveId)) {
          clearTimeout(activeTimers.get(retrospectiveId)!)
          activeTimers.delete(retrospectiveId)
        }
        break

      case "resume":
        // Get current state to calculate remaining time
        const currentState = await sql`
          SELECT timer_duration, timer_start_time 
          FROM retrospectives 
          WHERE id = ${retrospectiveId}
        `

        if (currentState.length > 0) {
          const startTime = new Date(currentState[0].timer_start_time)
          const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
          const remaining = Math.max(0, currentState[0].timer_duration - elapsed)

          if (remaining > 0) {
            await sql`
              UPDATE retrospectives 
              SET 
                timer_start_time = NOW() - INTERVAL '${elapsed} seconds',
                timer_is_running = true,
                timer_is_paused = false
              WHERE id = ${retrospectiveId}
            `

            // Set server-side timer for remaining time
            const timeout = setTimeout(async () => {
              await sql`
                UPDATE retrospectives 
                SET timer_is_running = false, timer_is_paused = false
                WHERE id = ${retrospectiveId}
              `
              activeTimers.delete(retrospectiveId)
            }, remaining * 1000)

            activeTimers.set(retrospectiveId, timeout)
          }
        }
        break

      case "stop":
        await sql`
          UPDATE retrospectives 
          SET 
            timer_is_running = false,
            timer_is_paused = false,
            timer_start_time = NULL
          WHERE id = ${retrospectiveId}
        `

        // Clear server-side timer
        if (activeTimers.has(retrospectiveId)) {
          clearTimeout(activeTimers.get(retrospectiveId)!)
          activeTimers.delete(retrospectiveId)
        }
        break

      case "set_duration":
        if (!duration || duration <= 0) {
          return NextResponse.json({ error: "Valid duration required" }, { status: 400 })
        }

        await sql`
          UPDATE retrospectives 
          SET timer_duration = ${duration}
          WHERE id = ${retrospectiveId}
        `
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Return updated timer state
    const updatedResult = await sql`
      SELECT 
        id,
        timer_duration,
        timer_start_time,
        timer_is_running,
        timer_is_paused
      FROM retrospectives 
      WHERE id = ${retrospectiveId}
    `

    const retrospective = updatedResult[0]
    let remainingTime = 0

    if (retrospective.timer_is_running && retrospective.timer_start_time && !retrospective.timer_is_paused) {
      const startTime = new Date(retrospective.timer_start_time)
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      remainingTime = Math.max(0, retrospective.timer_duration - elapsed)
    } else if (retrospective.timer_is_paused && retrospective.timer_start_time) {
      const startTime = new Date(retrospective.timer_start_time)
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      remainingTime = Math.max(0, retrospective.timer_duration - elapsed)
    } else {
      remainingTime = retrospective.timer_duration || 0
    }

    const timerState: TimerState = {
      id: retrospective.id,
      duration: retrospective.timer_duration || 0,
      start_time: retrospective.timer_start_time,
      is_running: retrospective.timer_is_running || false,
      is_paused: retrospective.timer_is_paused || false,
      remaining_time: remainingTime,
    }

    return NextResponse.json(timerState)
  } catch (error) {
    console.error("Timer POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
