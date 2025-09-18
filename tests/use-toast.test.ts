import assert from 'node:assert'
import { afterEach, test } from 'node:test'

import { reducer, resetToastTestState } from '../hooks/use-toast'

type ToastState = {
  toasts: Array<{
    id: string
    title?: string
    description?: string
    open?: boolean
  }>
}

const createToast = (overrides?: Partial<ToastState['toasts'][number]>): ToastState['toasts'][number] => ({
  id: 'toast-' + Math.random().toString(16).slice(2),
  title: 'Test Toast',
  open: true,
  ...overrides,
})

afterEach(() => {
  resetToastTestState()
})

test('ADD_TOAST prepends the toast and enforces the toast limit', () => {
  const initial: ToastState = { toasts: [] }

  const first = reducer(initial as any, {
    type: 'ADD_TOAST',
    toast: createToast({ id: 'first' }),
  }) as ToastState

  assert.strictEqual(first.toasts.length, 1)
  assert.strictEqual(first.toasts[0]?.id, 'first')

  const second = reducer(first as any, {
    type: 'ADD_TOAST',
    toast: createToast({ id: 'second' }),
  }) as ToastState

  assert.strictEqual(second.toasts.length, 1)
  assert.strictEqual(second.toasts[0]?.id, 'second')
})

test('UPDATE_TOAST merges data into an existing toast', () => {
  const initial: ToastState = {
    toasts: [createToast({ id: 'update-me', title: 'Initial Title', description: 'Old description' })],
  }

  const updated = reducer(initial as any, {
    type: 'UPDATE_TOAST',
    toast: { id: 'update-me', description: 'Updated description' },
  }) as ToastState

  assert.strictEqual(updated.toasts[0]?.id, 'update-me')
  assert.strictEqual(updated.toasts[0]?.title, 'Initial Title')
  assert.strictEqual(updated.toasts[0]?.description, 'Updated description')
})

test('DISMISS_TOAST closes only the targeted toast when an id is provided', () => {
  const initial: ToastState = {
    toasts: [createToast({ id: 'keep-open' }), createToast({ id: 'close-me' })],
  }

  const dismissed = reducer(initial as any, {
    type: 'DISMISS_TOAST',
    toastId: 'close-me',
  }) as ToastState

  const closeMe = dismissed.toasts.find((toast) => toast.id === 'close-me')
  const keepOpen = dismissed.toasts.find((toast) => toast.id === 'keep-open')

  assert.strictEqual(closeMe?.open, false)
  assert.strictEqual(keepOpen?.open, true)
})

test('REMOVE_TOAST deletes a toast by id and clears all when no id is provided', () => {
  const initial: ToastState = {
    toasts: [createToast({ id: 'a' }), createToast({ id: 'b' })],
  }

  const afterRemoval = reducer(initial as any, {
    type: 'REMOVE_TOAST',
    toastId: 'a',
  }) as ToastState

  assert.deepStrictEqual(afterRemoval.toasts.map((toast) => toast.id), ['b'])

  const cleared = reducer(initial as any, {
    type: 'REMOVE_TOAST',
  }) as ToastState

  assert.strictEqual(cleared.toasts.length, 0)
})
