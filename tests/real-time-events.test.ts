import { afterAll, afterEach, describe, expect, it } from 'vitest'

import {
  broadcastFeedbackEvent,
  createFeedbackEvent,
  createTimerEvent,
  eventStore,
  stopEventStoreCleanup,
} from '../lib/real-time-events'

const originalDateNow = Date.now

describe('real-time events', () => {
  afterEach(() => {
    Date.now = originalDateNow
  })

  afterAll(() => {
    stopEventStoreCleanup()
  })

  it('createTimerEvent attaches the correct metadata', () => {
    const now = 1_700_000_000
    Date.now = () => now

    const event = createTimerEvent('timer_start', 101, {
      duration: 120,
      remaining_time: 120,
      is_running: true,
      is_paused: false,
      start_time: new Date(now).toISOString(),
    })

    expect(event.type).toBe('timer_start')
    expect(event.retrospectiveId).toBe(101)
    expect(event.timestamp).toBe(now)
    expect(event.data.duration).toBe(120)
  })

  it('eventStore returns only events newer than the provided timestamp', () => {
    const retroId = 202
    const initialTime = 5_000
    Date.now = () => initialTime

    const first = createFeedbackEvent('feedback_added', retroId, { id: 1, content: 'First' })
    broadcastFeedbackEvent(first)

    Date.now = () => initialTime + 100
    const second = createFeedbackEvent('feedback_updated', retroId, { id: 1, content: 'Updated' })
    broadcastFeedbackEvent(second)

    const events = eventStore.getEventsSince(retroId, initialTime)

    expect(events).toHaveLength(1)
    expect(events[0]?.timestamp).toBe(second.timestamp)
    expect(events[0]?.type).toBe('feedback_updated')
  })

  it('eventStore.cleanup removes stale retrospectives', () => {
    const retroId = 303
    const baseTime = 10_000
    Date.now = () => baseTime

    const event = createFeedbackEvent('feedback_added', retroId, { id: 1 })
    broadcastFeedbackEvent(event)

    // Advance time past the retention window (5 minutes)
    Date.now = () => baseTime + 10 * 60 * 1000
    eventStore.cleanup()

    const events = eventStore.getEventsSince(retroId, 0)
    expect(events).toHaveLength(0)
  })
})
