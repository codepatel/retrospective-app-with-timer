import assert from 'node:assert'
import { afterEach, beforeEach, test } from 'node:test'

import { getDeviceId } from '../lib/device-id'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys())
    return index >= 0 && index < keys.length ? keys[index] : null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

const originalWindow = globalThis.window
const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage
const originalRandomUUID = globalThis.crypto.randomUUID

beforeEach(() => {
  // Reset globals to their original state before each test
  if (originalWindow === undefined) {
    delete (globalThis as any).window
  } else {
    ;(globalThis as any).window = originalWindow
  }

  if (originalLocalStorage === undefined) {
    delete (globalThis as any).localStorage
  } else {
    ;(globalThis as any).localStorage = originalLocalStorage
  }

  globalThis.crypto.randomUUID = originalRandomUUID
})

afterEach(() => {
  // Ensure globals are restored even if a test mutates them
  if (originalWindow === undefined) {
    delete (globalThis as any).window
  } else {
    ;(globalThis as any).window = originalWindow
  }

  if (originalLocalStorage === undefined) {
    delete (globalThis as any).localStorage
  } else {
    ;(globalThis as any).localStorage = originalLocalStorage
  }

  globalThis.crypto.randomUUID = originalRandomUUID
})

test('returns a fallback value when executed without a browser window', () => {
  delete (globalThis as any).window
  delete (globalThis as any).localStorage

  const result = getDeviceId()

  assert.strictEqual(result, 'server-fallback')
})

test('generates and persists a new id when one is not stored', () => {
  const storage = new MemoryStorage()
  ;(globalThis as any).localStorage = storage
  ;(globalThis as any).window = { localStorage: storage }

  globalThis.crypto.randomUUID = () => '11111111-2222-3333-4444-555555555555'

  const result = getDeviceId()

  assert.strictEqual(result, '11111111-2222-3333-4444-555555555555')
  assert.strictEqual(
    storage.getItem('retrospective-device-id'),
    '11111111-2222-3333-4444-555555555555',
  )
})

test('returns an existing id without calling randomUUID', () => {
  const storage = new MemoryStorage()
  storage.setItem('retrospective-device-id', 'existing-id')

  ;(globalThis as any).localStorage = storage
  ;(globalThis as any).window = { localStorage: storage }

  let wasCalled = false
  globalThis.crypto.randomUUID = () => {
    wasCalled = true
    return '99999999-aaaa-bbbb-cccc-dddddddddddd'
  }

  const result = getDeviceId()

  assert.strictEqual(result, 'existing-id')
  assert.strictEqual(wasCalled, false)
})
