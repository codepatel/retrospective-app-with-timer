"use client"

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, Square, Clock } from "lucide-react"

const TIMER_OPTIONS = [
  { value: 1, label: "1 minute" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
]

export interface TimerControlsRef {
  resetTimer: () => void
}

export const TimerControls = forwardRef<TimerControlsRef>((props, ref) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(5)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            // Timer finished - could add notification here
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
  }, [isRunning, timeLeft])

  const startTimer = () => {
    setTimeLeft(selectedMinutes * 60)
    setIsRunning(true)
  }

  const pauseTimer = () => {
    setIsRunning(false)
  }

  const stopTimer = () => {
    setIsRunning(false)
    setTimeLeft(0)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setTimeLeft(0)
    setSelectedMinutes(5) // Reset to default 5 minutes
  }

  useImperativeHandle(ref, () => ({
    resetTimer,
  }))

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-600" />
        <Select
          value={selectedMinutes.toString()}
          onValueChange={(value) => setSelectedMinutes(Number.parseInt(value))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
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
        {timeLeft === 0 ? (
          <Button onClick={startTimer} size="sm">
            <Play className="w-4 h-4 mr-2" />
            Start Timer
          </Button>
        ) : (
          <>
            <div className="text-lg font-mono font-semibold text-slate-700 min-w-[60px]">{formatTime(timeLeft)}</div>
            {isRunning ? (
              <Button onClick={pauseTimer} size="sm" variant="outline">
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            ) : (
              <Button onClick={() => setIsRunning(true)} size="sm">
                <Play className="w-4 h-4 mr-2" />
                Resume
              </Button>
            )}
            <Button onClick={stopTimer} size="sm" variant="outline">
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  )
})

TimerControls.displayName = "TimerControls"
