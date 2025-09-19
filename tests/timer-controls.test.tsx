import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TimerControls } from "@/components/timer-controls"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import type { Mock, SpyInstance } from "vitest"

type TimerState = {
  remaining_time: number
  is_running: boolean
  is_paused: boolean
  duration: number
  controlled_by: string | null
}

const toastSpy = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}))

const createTimerState = (overrides: Partial<TimerState> = {}): TimerState => ({
  remaining_time: 0,
  is_running: false,
  is_paused: false,
  duration: 0,
  controlled_by: null,
  ...overrides,
})

const createFetchResponse = (state: TimerState) =>
  ({
    ok: true,
    status: 200,
    json: async () => state,
  } as Response)

describe("TimerControls", () => {
  const retrospectiveId = 1
  const userAgentValue = "AgentAlpha"
  const mockTimestamp = 1700000000000
  const expectedDeviceId = `${userAgentValue}-${mockTimestamp}`

  const originalFetch = globalThis.fetch

  let fetchMock: Mock
  let dateSpy: SpyInstance
  let userAgentSpy: SpyInstance

  beforeEach(() => {
    toastSpy.mockClear()

    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    dateSpy = vi.spyOn(Date, "now").mockReturnValue(mockTimestamp)
    userAgentSpy = vi
      .spyOn(window.navigator, "userAgent", "get")
      .mockReturnValue(userAgentValue)
  })

  afterEach(() => {
    dateSpy.mockRestore()
    userAgentSpy.mockRestore()
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it("starts the timer when the start button is pressed", async () => {
    fetchMock
      .mockResolvedValueOnce(createFetchResponse(createTimerState()))
      .mockResolvedValueOnce(
        createFetchResponse(
          createTimerState({
            remaining_time: 600,
            is_running: true,
            is_paused: false,
            duration: 600,
            controlled_by: expectedDeviceId,
          }),
        ),
      )

    render(<TimerControls retrospectiveId={retrospectiveId} />)

    const startButton = await screen.findByRole("button", { name: /start timer/i })

    await userEvent.click(startButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(fetchMock.mock.calls[1][0]).toBe(
      `/api/retrospectives/${retrospectiveId}/timer`,
    )

    const requestInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(requestInit?.method).toBe("POST")
    expect(requestInit?.headers).toEqual({ "Content-Type": "application/json" })

    const parsedBody = JSON.parse(requestInit?.body as string)
    expect(parsedBody).toEqual({
      action: "start",
      duration: 600,
      deviceId: expectedDeviceId,
    })

    expect(await screen.findByRole("button", { name: /pause/i })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: /stop/i })).toBeInTheDocument()
    expect(screen.getByText(/^[0-9]{2}:[0-9]{2}$/)).toBeInTheDocument()

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Success",
        description: "Timer started successfully",
      }),
    )
  })

  it("pauses the timer and shows resume controls", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createFetchResponse(
          createTimerState({
            remaining_time: 300,
            is_running: true,
            is_paused: false,
            duration: 600,
            controlled_by: expectedDeviceId,
          }),
        ),
      )
      .mockResolvedValueOnce(
        createFetchResponse(
          createTimerState({
            remaining_time: 300,
            is_running: false,
            is_paused: true,
            duration: 600,
            controlled_by: expectedDeviceId,
          }),
        ),
      )

    render(<TimerControls retrospectiveId={retrospectiveId} />)

    const pauseButton = await screen.findByRole("button", { name: /pause/i })

    await userEvent.click(pauseButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const requestInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(requestInit?.method).toBe("POST")

    const parsedBody = JSON.parse(requestInit?.body as string)
    expect(parsedBody).toEqual({
      action: "pause",
      deviceId: expectedDeviceId,
    })

    expect(await screen.findByRole("button", { name: /resume/i })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: /stop/i })).toBeInTheDocument()

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Success",
        description: "Timer paused successfully",
      }),
    )
  })

  it("stops the timer and restores the initial state", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createFetchResponse(
          createTimerState({
            remaining_time: 420,
            is_running: true,
            is_paused: false,
            duration: 600,
            controlled_by: expectedDeviceId,
          }),
        ),
      )
      .mockResolvedValueOnce(
        createFetchResponse(
          createTimerState({
            remaining_time: 0,
            is_running: false,
            is_paused: false,
            duration: 0,
            controlled_by: null,
          }),
        ),
      )

    render(<TimerControls retrospectiveId={retrospectiveId} />)

    const stopButton = await screen.findByRole("button", { name: /stop/i })

    await userEvent.click(stopButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const requestInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(requestInit?.method).toBe("POST")

    const parsedBody = JSON.parse(requestInit?.body as string)
    expect(parsedBody).toEqual({
      action: "stop",
      deviceId: expectedDeviceId,
    })

    const startButton = await screen.findByRole("button", { name: /start timer/i })
    expect(startButton).toBeEnabled()
    expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/^[0-9]{2}:[0-9]{2}$/)).not.toBeInTheDocument()

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Success",
        description: "Timer stopped successfully",
      }),
    )
  })
})
