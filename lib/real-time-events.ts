// Real-time event system for synchronizing timer and feedback updates across clients

export interface TimerEvent {
  type: "timer_start" | "timer_pause" | "timer_resume" | "timer_stop" | "timer_update"
  retrospectiveId: number
  timestamp: number
  data: {
    duration: number
    remaining_time: number
    is_running: boolean
    is_paused: boolean
    start_time: string | null
  }
}

export interface FeedbackEvent {
  type: "feedback_added" | "feedback_updated" | "feedback_voted" | "feedback_deleted" | "timer_visibility_changed"
  retrospectiveId: number
  timestamp: number
  data: {
    id?: number
    content?: string
    category?: string
    vote_count?: number
    action?: "added" | "removed"
    timer_enabled?: boolean
  }
}

export type RealtimeEvent = TimerEvent | FeedbackEvent

// Event store for tracking recent events
class EventStore {
  private events: Map<number, RealtimeEvent[]> = new Map()
  private readonly MAX_EVENTS_PER_RETROSPECTIVE = 100
  private readonly EVENT_RETENTION_MS = 5 * 60 * 1000 // 5 minutes

  addEvent(retrospectiveId: number, event: RealtimeEvent) {
    if (!this.events.has(retrospectiveId)) {
      this.events.set(retrospectiveId, [])
    }

    const events = this.events.get(retrospectiveId)!
    events.push(event)

    // Keep only recent events
    if (events.length > this.MAX_EVENTS_PER_RETROSPECTIVE) {
      events.splice(0, events.length - this.MAX_EVENTS_PER_RETROSPECTIVE)
    }

    // Clean up old events
    this.cleanupOldEvents(retrospectiveId)
  }

  getEventsSince(retrospectiveId: number, timestamp: number): RealtimeEvent[] {
    const events = this.events.get(retrospectiveId) || []
    return events.filter((event) => event.timestamp > timestamp)
  }

  getLatestTimestamp(retrospectiveId: number): number {
    const events = this.events.get(retrospectiveId) || []
    return events.length > 0 ? Math.max(...events.map((e) => e.timestamp)) : 0
  }

  private cleanupOldEvents(retrospectiveId: number) {
    const events = this.events.get(retrospectiveId)
    if (!events) return

    const cutoff = Date.now() - this.EVENT_RETENTION_MS
    const filteredEvents = events.filter((event) => event.timestamp > cutoff)

    if (filteredEvents.length !== events.length) {
      this.events.set(retrospectiveId, filteredEvents)
    }
  }

  // Clean up events for inactive retrospectives
  cleanup() {
    const cutoff = Date.now() - this.EVENT_RETENTION_MS
    for (const [retrospectiveId, events] of this.events.entries()) {
      const recentEvents = events.filter((event) => event.timestamp > cutoff)
      if (recentEvents.length === 0) {
        this.events.delete(retrospectiveId)
      } else if (recentEvents.length !== events.length) {
        this.events.set(retrospectiveId, recentEvents)
      }
    }
  }
}

// Global event store instance
export const eventStore = new EventStore()

// Cleanup old events every minute
setInterval(() => {
  eventStore.cleanup()
}, 60 * 1000)

// Helper functions for creating events
export function createTimerEvent(
  type: TimerEvent["type"],
  retrospectiveId: number,
  timerData: TimerEvent["data"],
): TimerEvent {
  return {
    type,
    retrospectiveId,
    timestamp: Date.now(),
    data: timerData,
  }
}

export function createFeedbackEvent(
  type: FeedbackEvent["type"],
  retrospectiveId: number,
  feedbackData: FeedbackEvent["data"],
): FeedbackEvent {
  return {
    type,
    retrospectiveId,
    timestamp: Date.now(),
    data: feedbackData,
  }
}

// Event broadcasting functions
export function broadcastTimerEvent(event: TimerEvent) {
  eventStore.addEvent(event.retrospectiveId, event)
  console.log(`[REALTIME] Timer event: ${event.type} for retrospective ${event.retrospectiveId}`)
}

export function broadcastFeedbackEvent(event: FeedbackEvent) {
  eventStore.addEvent(event.retrospectiveId, event)
  console.log(`[REALTIME] Feedback event: ${event.type} for retrospective ${event.retrospectiveId}`)
}
