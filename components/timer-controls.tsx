"use client"

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, Square, Clock, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { TimerEvent } from "@/lib/real-time-events"

const TIMER_OPTIONS = [
  { value: 1, label: "1 minute" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
]

export interface TimerControlsRef {
  resetTimer: () => void
  handleTimerEvent: (event: TimerEvent) => void
}

interface TimerControlsProps {
  retrospectiveId: number | null
}

export const TimerControls = forwardRef<TimerControlsRef, TimerControlsProps>(({ retrospectiveId }, ref) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(10)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [controlledBy, setControlledBy] = useState<string | null>(null)
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const generateDeviceId = () => {
      const userAgent = navigator.userAgent || ""
      const timestamp = Date.now()
      return `${userAgent.slice(0, 50)}-${timestamp}`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 100)
    }
    setCurrentDeviceId(generateDeviceId())
  }, [])

  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            setIsPaused(false)
            setControlledBy(null)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, isPaused, timeLeft])

  useEffect(() => {
    if (retrospectiveId) {
      loadTimerState()
    }
  }, [retrospectiveId])

  const loadTimerState = async () => {
    if (!retrospectiveId) return

    try {
      const response = await fetch(`/api/retrospectives/${retrospectiveId}/timer`)
      if (response.ok) {
        const timerState = await response.json()
        setTimeLeft(timerState.remaining_time)
        setIsRunning(timerState.is_running)
        setIsPaused(timerState.is_paused)
        if (timerState.duration > 0) {
          setSelectedMinutes(Math.ceil(timerState.duration / 60))
        }
        setControlledBy(timerState.controlled_by)

        if (timerState.is_running && !timerState.is_paused && timerState.remaining_time > 0) {
          // Clear any existing interval first
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }

          // Start countdown immediately
          intervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                setIsRunning(false)
                setIsPaused(false)
                setControlledBy(null)
                return 0
              }
              return prev - 1
            })
          }, 1000)
        }
      }
    } catch (error) {
      console.error("Failed to load timer state:", error)
    }
  }

  const performTimerAction = async (action: string, duration?: number) => {
    if (!retrospectiveId) return

    setIsLoading(true)
    try {
      const requestBody = { action, duration }

      const response = await fetch(`/api/retrospectives/${retrospectiveId}/timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const timerState = await response.json()
        setTimeLeft(timerState.remaining_time)
        setIsRunning(timerState.is_running)
        setIsPaused(timerState.is_paused)
        setControlledBy(timerState.controlled_by)

        toast({
          title: "Success",
          description: `Timer ${action}ed successfully`,
        })
      } else {
        const error = await response.json()
        if (response.status === 403) {
          toast({
            title: "Timer Locked",
            description: "Another user is controlling the timer",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: error.error || `Failed to ${action} timer`,
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} timer:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} timer`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const startTimer = () => {
    performTimerAction("start", selectedMinutes * 60)
  }

  const pauseTimer = () => {
    performTimerAction("pause")
  }

  const resumeTimer = () => {
    performTimerAction("resume")
  }

  const stopTimer = () => {
    performTimerAction("stop")
  }

  const resetTimer = () => {
    setIsRunning(false)
    setIsPaused(false)
    setTimeLeft(0)
    setSelectedMinutes(10)
    setControlledBy(null)
    if (retrospectiveId) {
      performTimerAction("stop")
    }
  }

  const handleTimerEvent = (event: TimerEvent) => {
    console.log("[TIMER] Received event:", event.type, event.data)

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setTimeLeft(event.data.remaining_time)
    setIsRunning(event.data.is_running)
    setIsPaused(event.data.is_paused)
    setControlledBy(event.data.controlled_by)

    if (event.data.duration > 0) {
      setSelectedMinutes(Math.ceil(event.data.duration / 60))
    }

    // Show notification for timer events from other users
    if (event.type === "timer_start") {
      toast({
        title: "Timer Started",
        description: `Timer started by another user (${Math.ceil(event.data.duration / 60)} minutes)`,
      })
    } else if (event.type === "timer_stop") {
      toast({
        title: "Timer Stopped",
        description: "Timer stopped by another user",
      })
    }
  }

  useImperativeHandle(ref, () => ({
    resetTimer,
    handleTimerEvent,
  }))

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const hasControl = !controlledBy || controlledBy === currentDeviceId

  console.log("[v0] Timer Controls Debug:", {
    hasControl,
    controlledBy,
    currentDeviceId,
    isLoading,
    retrospectiveId,
    isRunning,
    isPaused,
    timeLeft,
    startButtonDisabled: isLoading || !retrospectiveId || !hasControl,
    pauseButtonDisabled: isLoading || !hasControl,
    resumeButtonDisabled: isLoading || !hasControl,
    stopButtonDisabled: isLoading || !hasControl,
  })

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-600" />
        <Select
          value={selectedMinutes.toString()}
          defaultValue="10"
          onValueChange={(value) => setSelectedMinutes(Number.parseInt(value))}
          disabled={isRunning || isLoading}
        >
          <SelectTrigger className="w-32">
            <SelectValue>
              {TIMER_OPTIONS.find((option) => option.value === selectedMinutes)?.label || "10 minutes"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIMER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        {!hasControl && (
          <div className="flex items-center gap-1 text-amber-600 text-sm">
            <Lock className="w-3 h-3" />
            <span>Locked</span>
          </div>
        )}

        {timeLeft === 0 ? (
          <Button onClick={startTimer} size="sm" disabled={isLoading || !retrospectiveId || !hasControl}>
            <Play className="w-4 h-4 mr-2" />
            {isLoading ? "Starting..." : "Start Timer"}
          </Button>
        ) : (
          <>
            <div className="text-lg font-mono font-semibold text-slate-700 min-w-[60px]">{formatTime(timeLeft)}</div>
            {isRunning && !isPaused ? (
              <Button onClick={pauseTimer} size="sm" variant="outline" disabled={isLoading || !hasControl}>
                <Pause className="w-4 h-4 mr-2" />
                {isLoading ? "Pausing..." : "Pause"}
              </Button>
            ) : (
              <Button onClick={resumeTimer} size="sm" disabled={isLoading || !hasControl}>
                <Play className="w-4 h-4 mr-2" />
                {isLoading ? "Resuming..." : "Resume"}
              </Button>
            )}
            <Button onClick={stopTimer} size="sm" variant="outline" disabled={isLoading || !hasControl}>
              <Square className="w-4 h-4 mr-2" />
              {isLoading ? "Stopping..." : "Stop"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
})

TimerControls.displayName = "TimerControls"
