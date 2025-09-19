import { afterEach, describe, expect, it } from 'vitest'

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

describe('useToast reducer', () => {
  afterEach(() => {
    resetToastTestState()
  })

  it('ADD_TOAST prepends the toast and enforces the toast limit', () => {
    const initial: ToastState = { toasts: [] }

    const first = reducer(initial as any, {
      type: 'ADD_TOAST',
      toast: createToast({ id: 'first' }),
    }) as ToastState

    expect(first.toasts).toHaveLength(1)
    expect(first.toasts[0]?.id).toBe('first')

    const second = reducer(first as any, {
      type: 'ADD_TOAST',
      toast: createToast({ id: 'second' }),
    }) as ToastState

    expect(second.toasts).toHaveLength(1)
    expect(second.toasts[0]?.id).toBe('second')
  })

  it('UPDATE_TOAST merges data into an existing toast', () => {
    const initial: ToastState = {
      toasts: [createToast({ id: 'update-me', title: 'Initial Title', description: 'Old description' })],
    }

    const updated = reducer(initial as any, {
      type: 'UPDATE_TOAST',
      toast: { id: 'update-me', description: 'Updated description' },
    }) as ToastState

    expect(updated.toasts[0]?.id).toBe('update-me')
    expect(updated.toasts[0]?.title).toBe('Initial Title')
    expect(updated.toasts[0]?.description).toBe('Updated description')
  })

  it('DISMISS_TOAST closes only the targeted toast when an id is provided', () => {
    const initial: ToastState = {
      toasts: [createToast({ id: 'keep-open' }), createToast({ id: 'close-me' })],
    }

    const dismissed = reducer(initial as any, {
      type: 'DISMISS_TOAST',
      toastId: 'close-me',
    }) as ToastState

    const closeMe = dismissed.toasts.find((toast) => toast.id === 'close-me')
    const keepOpen = dismissed.toasts.find((toast) => toast.id === 'keep-open')

    expect(closeMe?.open).toBe(false)
    expect(keepOpen?.open).toBe(true)
  })

  it('REMOVE_TOAST deletes a toast by id and clears all when no id is provided', () => {
    const initial: ToastState = {
      toasts: [createToast({ id: 'a' }), createToast({ id: 'b' })],
    }

    const afterRemoval = reducer(initial as any, {
      type: 'REMOVE_TOAST',
      toastId: 'a',
    }) as ToastState

    expect(afterRemoval.toasts.map((toast) => toast.id)).toEqual(['b'])

    const cleared = reducer(initial as any, {
      type: 'REMOVE_TOAST',
    }) as ToastState

    expect(cleared.toasts).toHaveLength(0)
  })
})
