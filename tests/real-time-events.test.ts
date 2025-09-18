import assert from 'node:assert'
import { after, afterEach, test } from 'node:test'

import {
  broadcastFeedbackEvent,
  createFeedbackEvent,
  createTimerEvent,
  eventStore,
  stopEventStoreCleanup,
} from '../lib/real-time-events'

const originalDateNow = Date.now

afterEach(() => {
  Date.now = originalDateNow
})

after(() => {
  stopEventStoreCleanup()
})

test('createTimerEvent attaches the correct metadata', () => {
  const now = 1_700_000_000
  Date.now = () => now

  const event = createTimerEvent('timer_start', 101, {
    duration: 120,
    remaining_time: 120,
    is_running: true,
    is_paused: false,
    start_time: new Date(now).toISOString(),
  })

  assert.strictEqual(event.type, 'timer_start')
  assert.strictEqual(event.retrospectiveId, 101)
  assert.strictEqual(event.timestamp, now)
  assert.strictEqual(event.data.duration, 120)
})

test('eventStore returns only events newer than the provided timestamp', () => {
  const retroId = 202
  const initialTime = 5_000
  Date.now = () => initialTime

  const first = createFeedbackEvent('feedback_added', retroId, { id: 1, content: 'First' })
  broadcastFeedbackEvent(first)

  Date.now = () => initialTime + 100
  const second = createFeedbackEvent('feedback_updated', retroId, { id: 1, content: 'Updated' })
  broadcastFeedbackEvent(second)

  const events = eventStore.getEventsSince(retroId, initialTime)

  assert.strictEqual(events.length, 1)
  assert.strictEqual(events[0]?.timestamp, second.timestamp)
  assert.strictEqual(events[0]?.type, 'feedback_updated')
})

test('eventStore.cleanup removes stale retrospectives', () => {
  const retroId = 303
  const baseTime = 10_000
  Date.now = () => baseTime

  const event = createFeedbackEvent('feedback_added', retroId, { id: 1 })
  broadcastFeedbackEvent(event)

  // Advance time past the retention window (5 minutes)
  Date.now = () => baseTime + 10 * 60 * 1000
  eventStore.cleanup()

  const events = eventStore.getEventsSince(retroId, 0)
  assert.strictEqual(events.length, 0)
})
