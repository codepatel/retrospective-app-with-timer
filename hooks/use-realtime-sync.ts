"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { TimerEvent, FeedbackEvent } from "@/lib/real-time-events"

interface UseRealtimeSyncOptions {
  retrospectiveId: number | null
  onTimerEvent?: (event: TimerEvent) => void
  onFeedbackEvent?: (event: FeedbackEvent) => void
  pollInterval?: number
  enabled?: boolean
}

interface RealtimeSyncState {
  isConnected: boolean
  lastUpdate: number
  eventCount: number
  error: string | null
}

export function useRealtimeSync({
  retrospectiveId,
  onTimerEvent,
  onFeedbackEvent,
  pollInterval = 1000, // 1 second polling
  enabled = true,
}: UseRealtimeSyncOptions) {
  const [state, setState] = useState<RealtimeSyncState>({
    isConnected: false,
    lastUpdate: 0,
    eventCount: 0,
    error: null,
  })

  const lastTimestampRef = useRef<number>(0)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef<boolean>(false)

  const onTimerEventRef = useRef(onTimerEvent)
  const onFeedbackEventRef = useRef(onFeedbackEvent)

  // Update refs when callbacks change
  useEffect(() => {
    onTimerEventRef.current = onTimerEvent
  }, [onTimerEvent])

  useEffect(() => {
    onFeedbackEventRef.current = onFeedbackEvent
  }, [onFeedbackEvent])

  const pollForEvents = useCallback(async () => {
    if (!retrospectiveId || !enabled || isPollingRef.current) {
      return
    }

    isPollingRef.current = true

    try {
      const response = await fetch(`/api/events/${retrospectiveId}?since=${lastTimestampRef.current}`, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.has_updates && data.events.length > 0) {
        // Process events using refs to avoid dependency issues
        for (const event of data.events) {
          if (event.type.startsWith("timer_") && onTimerEventRef.current) {
            onTimerEventRef.current(event as TimerEvent)
          } else if (event.type.startsWith("feedback_") && onFeedbackEventRef.current) {
            onFeedbackEventRef.current(event as FeedbackEvent)
          }
        }

        // Update state
        setState((prev) => ({
          ...prev,
          isConnected: true,
          lastUpdate: Date.now(),
          eventCount: prev.eventCount + data.events.length,
          error: null,
        }))

        lastTimestampRef.current = data.latest_timestamp
      } else {
        // No updates, but connection is healthy
        setState((prev) => ({
          ...prev,
          isConnected: true,
          error: null,
        }))
      }
    } catch (error) {
      console.error("[REALTIME] Polling error:", error)
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }))
    } finally {
      isPollingRef.current = false
    }
  }, [retrospectiveId, enabled]) // Removed callback dependencies

  useEffect(() => {
    if (!retrospectiveId || !enabled) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
      setState((prev) => ({ ...prev, isConnected: false }))
      return
    }

    // Reset timestamp when retrospective changes
    lastTimestampRef.current = 0

    const startPolling = () => {
      pollForEvents()
      pollTimeoutRef.current = setTimeout(startPolling, pollInterval)
    }

    startPolling()

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [retrospectiveId, enabled, pollInterval, pollForEvents])

  // Manual refresh function
  const refresh = useCallback(() => {
    if (retrospectiveId && enabled) {
      pollForEvents()
    }
  }, [retrospectiveId, enabled, pollForEvents])

  return {
    ...state,
    refresh,
  }
}
