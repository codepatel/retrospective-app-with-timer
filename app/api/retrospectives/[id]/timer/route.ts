import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { broadcastTimerEvent, createTimerEvent } from "@/lib/real-time-events"

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
  controlled_by: string | null
}

function getDeviceId(request: NextRequest): string {
  const userAgent = request.headers.get("user-agent") || ""
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const timestamp = Date.now()
  return `${ip}-${userAgent.slice(0, 50)}-${timestamp}`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 100)
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const retrospectiveId = Number.parseInt(params.id)

    if (isNaN(retrospectiveId)) {
      return NextResponse.json({ error: "Invalid retrospective ID" }, { status: 400 })
    }

    let result
    try {
      result = await sql`
        SELECT 
          id,
          timer_duration,
          timer_start_time,
          timer_is_running,
          timer_is_paused,
          timer_controlled_by,
          timer_remaining_time
        FROM retrospectives 
        WHERE id = ${retrospectiveId} AND is_active = true
      `
    } catch (columnError) {
      // Fallback query without timer_controlled_by or timer_remaining_time columns
      console.log("[v0] timer columns not found, using fallback query")
      result = await sql`
        SELECT 
          id,
          timer_duration,
          timer_start_time,
          timer_is_running,
          timer_is_paused
        FROM retrospectives 
        WHERE id = ${retrospectiveId} AND is_active = true
      `
      // Add null/default values for missing columns
      result = result.map((row) => ({
        ...row,
        timer_controlled_by: null,
        timer_remaining_time: 0,
      }))
    }

    if (result.length === 0) {
      return NextResponse.json({ error: "Retrospective not found" }, { status: 404 })
    }

    const retrospective = result[0]
    let remainingTime = 0

    // Calculate remaining time based on timer state
    if (retrospective.timer_is_paused) {
      remainingTime = retrospective.timer_remaining_time || 0
    } else if (retrospective.timer_is_running && retrospective.timer_start_time) {
      const startTime = new Date(retrospective.timer_start_time)
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      remainingTime = Math.max(0, retrospective.timer_duration - elapsed)

      // If timer has expired, update database
      if (remainingTime === 0) {
        try {
          await sql`
            UPDATE retrospectives 
            SET timer_is_running = false, timer_is_paused = false, timer_controlled_by = NULL, timer_remaining_time = 0
            WHERE id = ${retrospectiveId}
          `
        } catch (updateError) {
          // Fallback update without new columns
          await sql`
            UPDATE retrospectives 
            SET timer_is_running = false, timer_is_paused = false
            WHERE id = ${retrospectiveId}
          `
        }
        // Clear server-side timer
        if (activeTimers.has(retrospectiveId)) {
          clearTimeout(activeTimers.get(retrospectiveId)!)
          activeTimers.delete(retrospectiveId)
        }
      }
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
      controlled_by: retrospective.timer_controlled_by,
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
    const { action, duration, deviceId } = await request.json()
    const finalDeviceId = deviceId || getDeviceId(request)

    if (isNaN(retrospectiveId)) {
      return NextResponse.json({ error: "Invalid retrospective ID" }, { status: 400 })
    }

    let retrospectiveCheck
    try {
      retrospectiveCheck = await sql`
        SELECT id, timer_controlled_by, timer_is_running FROM retrospectives 
        WHERE id = ${retrospectiveId} AND is_active = true
      `
    } catch (columnError) {
      // Fallback query without timer_controlled_by column
      console.log("[v0] timer_controlled_by column not found in POST, using fallback")
      retrospectiveCheck = await sql`
        SELECT id, timer_is_running FROM retrospectives 
        WHERE id = ${retrospectiveId} AND is_active = true
      `
      // Add null controlled_by to each result
      retrospectiveCheck = retrospectiveCheck.map((row) => ({ ...row, timer_controlled_by: null }))
    }

    if (retrospectiveCheck.length === 0) {
      return NextResponse.json({ error: "Retrospective not found" }, { status: 404 })
    }

    const currentControlledBy = retrospectiveCheck[0].timer_controlled_by
    const isCurrentlyRunning = retrospectiveCheck[0].timer_is_running

    if (currentControlledBy && action !== "start" && currentControlledBy !== finalDeviceId) {
      return NextResponse.json(
        {
          error: "Timer is controlled by another client",
          controlled_by: currentControlledBy,
        },
        { status: 403 },
      )
    }

    if (action === "start" && isCurrentlyRunning && currentControlledBy && currentControlledBy !== finalDeviceId) {
      return NextResponse.json(
        {
          error: "Timer is already running and controlled by another client",
          controlled_by: currentControlledBy,
        },
        { status: 403 },
      )
    }

    const safeTimerUpdate = async (updateFields: Record<string, any>, whereClause = "") => {
      try {
        const setClause = Object.entries(updateFields)
          .map(([key, value]) => `${key} = ${typeof value === "string" ? `'${value}'` : value}`)
          .join(", ")

        const query = `UPDATE retrospectives SET ${setClause} WHERE id = ${retrospectiveId}${whereClause}`
        await sql.unsafe(query)
      } catch (controlledByError) {
        // Fallback: update without new columns
        const fallbackFields = { ...updateFields }
        delete fallbackFields.timer_controlled_by
        delete fallbackFields.timer_remaining_time

        if (Object.keys(fallbackFields).length > 0) {
          const setClause = Object.entries(fallbackFields)
            .map(([key, value]) => `${key} = ${typeof value === "string" ? `'${value}'` : value}`)
            .join(", ")

          const query = `UPDATE retrospectives SET ${setClause} WHERE id = ${retrospectiveId}${whereClause}`
          await sql.unsafe(query)
        }
      }
    }

    let timerState: TimerState

    switch (action) {
      case "start":
        if (!duration || duration <= 0) {
          return NextResponse.json({ error: "Valid duration required" }, { status: 400 })
        }

        await safeTimerUpdate({
          timer_duration: duration,
          timer_start_time: "NOW()",
          timer_is_running: true,
          timer_is_paused: false,
          timer_controlled_by: `'${finalDeviceId}'`,
        })

        // Set server-side timer to auto-stop when duration expires
        if (activeTimers.has(retrospectiveId)) {
          clearTimeout(activeTimers.get(retrospectiveId)!)
        }

        const timeout = setTimeout(async () => {
          await sql`
            UPDATE retrospectives 
            SET timer_is_running = false, timer_is_paused = false, timer_controlled_by = NULL, timer_remaining_time = 0
            WHERE id = ${retrospectiveId}
          `
          activeTimers.delete(retrospectiveId)
          broadcastTimerEvent(
            retrospectiveId,
            createTimerEvent("timer_stop", retrospectiveId, {
              duration: 0,
              remaining_time: 0,
              is_running: false,
              is_paused: false,
              start_time: null,
            }),
          )
        }, duration * 1000)

        activeTimers.set(retrospectiveId, timeout)
        timerState = {
          id: retrospectiveId,
          duration: duration,
          start_time: new Date(),
          is_running: true,
          is_paused: false,
          remaining_time: duration,
          controlled_by: finalDeviceId,
        }
        broadcastTimerEvent(retrospectiveId, createTimerEvent("timer_start", retrospectiveId, timerState))
        break

      case "pause":
        const currentTimerState = await sql`
          SELECT timer_duration, timer_start_time 
          FROM retrospectives 
          WHERE id = ${retrospectiveId} AND timer_is_running = true
        `

        if (currentTimerState.length === 0) {
          return NextResponse.json({ error: "No running timer found" }, { status: 400 })
        }

        const startTime = new Date(currentTimerState[0].timer_start_time)
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
        const remainingAtPause = Math.max(0, currentTimerState[0].timer_duration - elapsed)

        await safeTimerUpdate(
          {
            timer_is_running: false,
            timer_is_paused: true,
            timer_remaining_time: remainingAtPause,
          },
          ` AND timer_is_running = true`,
        )

        // Clear server-side timer
        if (activeTimers.has(retrospectiveId)) {
          clearTimeout(activeTimers.get(retrospectiveId)!)
          activeTimers.delete(retrospectiveId)
        }

        timerState = {
          id: retrospectiveId,
          duration: currentTimerState[0].timer_duration || 0,
          start_time: startTime,
          is_running: false,
          is_paused: true,
          remaining_time: remainingAtPause,
          controlled_by: finalDeviceId, // Preserve control for resume
        }
        broadcastTimerEvent(retrospectiveId, createTimerEvent("timer_pause", retrospectiveId, timerState))
        break

      case "resume":
        const pausedState = await sql`
          SELECT timer_remaining_time, timer_controlled_by 
          FROM retrospectives 
          WHERE id = ${retrospectiveId} AND timer_is_paused = true
        `

        if (pausedState.length === 0 || pausedState[0].timer_controlled_by !== finalDeviceId) {
          return NextResponse.json({ error: "No paused timer found or not controlled by this client" }, { status: 404 })
        }

        const remainingTime = pausedState[0].timer_remaining_time || 0

        if (remainingTime > 0) {
          await safeTimerUpdate({
            timer_start_time: "NOW()",
            timer_duration: remainingTime,
            timer_is_running: true,
            timer_is_paused: false,
            timer_remaining_time: 0,
          })

          // Set server-side timer for remaining time
          const timeout = setTimeout(async () => {
            await sql`
              UPDATE retrospectives 
              SET timer_is_running = false, timer_is_paused = false, timer_controlled_by = NULL, timer_remaining_time = 0
              WHERE id = ${retrospectiveId}
            `
            activeTimers.delete(retrospectiveId)
            broadcastTimerEvent(
              retrospectiveId,
              createTimerEvent("timer_stop", retrospectiveId, {
                duration: 0,
                remaining_time: 0,
                is_running: false,
                is_paused: false,
                start_time: null,
              }),
            )
          }, remainingTime * 1000)

          activeTimers.set(retrospectiveId, timeout)
          timerState = {
            id: retrospectiveId,
            duration: remainingTime,
            start_time: new Date(),
            is_running: true,
            is_paused: false,
            remaining_time: remainingTime,
            controlled_by: finalDeviceId,
          }
          broadcastTimerEvent(retrospectiveId, createTimerEvent("timer_resume", retrospectiveId, timerState))
        } else {
          return NextResponse.json({ error: "Timer has expired" }, { status: 400 })
        }
        break

      case "stop":
        await safeTimerUpdate({
          timer_is_running: false,
          timer_is_paused: false,
          timer_start_time: "NULL",
          timer_controlled_by: "NULL",
          timer_remaining_time: 0,
        })

        // Clear server-side timer
        if (activeTimers.has(retrospectiveId)) {
          clearTimeout(activeTimers.get(retrospectiveId)!)
          activeTimers.delete(retrospectiveId)
        }

        timerState = {
          id: retrospectiveId,
          duration: 0,
          start_time: null,
          is_running: false,
          is_paused: false,
          remaining_time: 0,
          controlled_by: null,
        }
        broadcastTimerEvent(retrospectiveId, createTimerEvent("timer_stop", retrospectiveId, timerState))
        break

      case "set_duration":
        if (!duration || duration <= 0) {
          return NextResponse.json({ error: "Valid duration required" }, { status: 400 })
        }

        await safeTimerUpdate({
          timer_duration: duration,
        })

        const setDurationResult = await sql`
          SELECT 
            timer_duration,
            timer_start_time,
            timer_is_running,
            timer_is_paused,
            timer_controlled_by,
            timer_remaining_time
          FROM retrospectives 
          WHERE id = ${retrospectiveId}
        `

        const setData = setDurationResult[0]
        timerState = {
          id: retrospectiveId,
          duration: setData.timer_duration || 0,
          start_time: setData.timer_start_time ? new Date(setData.timer_start_time) : null,
          is_running: setData.timer_is_running || false,
          is_paused: setData.timer_is_paused || false,
          remaining_time: setData.timer_remaining_time || 0,
          controlled_by: setData.timer_controlled_by,
        }
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json(timerState)
  } catch (error) {
    console.error("Timer POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
