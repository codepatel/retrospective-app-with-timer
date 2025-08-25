"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FeedbackColumn } from "@/components/feedback-column"
import { TimerControls, type TimerControlsRef } from "@/components/timer-controls"
import { Copy, RotateCcw, Share2, Wifi, WifiOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getDeviceId } from "@/lib/device-id"
import { useRealtimeSync } from "@/hooks/use-realtime-sync"
import { broadcastFeedbackEvent, createFeedbackEvent } from "@/lib/real-time-events"
import type { TimerEvent, FeedbackEvent } from "@/lib/real-time-events"

interface FeedbackItem {
  id: number
  content: string
  category: string
  vote_count: number
  created_at: string
}

interface Retrospective {
  id: number
  title: string
  session_id: string
  created_at: string
  is_active: boolean
}

const CATEGORIES = [
  { key: "what_went_right", title: "What went right?", color: "bg-green-50 border-green-200" },
  { key: "what_can_improve", title: "What can we do better?", color: "bg-yellow-50 border-yellow-200" },
  { key: "risks", title: "What risks do we have?", color: "bg-red-50 border-red-200" },
  { key: "resolutions", title: "Possible resolutions...", color: "bg-blue-50 border-blue-200" },
]

export function RetrospectiveBoard() {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [currentRetrospective, setCurrentRetrospective] = useState<Retrospective | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [shareUrl, setShareUrl] = useState<string>("")
  const [votedItems, setVotedItems] = useState<Set<number>>(new Set())
  const timerRef = useRef<TimerControlsRef>(null)
  const { toast } = useToast()
  const handleTimerEvent = (event: TimerEvent) => {
    console.log("[BOARD] Received timer event:", event.type)
    timerRef.current?.handleTimerEvent(event)
  }
  const handleFeedbackEvent = (event: FeedbackEvent) => {
    console.log("[BOARD] Received feedback event:", event.type, event.data)

    switch (event.type) {
      case "feedback_added":
        if (currentRetrospective) {
          loadFeedbackItems(currentRetrospective.id)
        }
        toast({
          title: "New Feedback",
          description: "Another user added feedback",
        })
        break

      case "feedback_updated":
        setFeedbackItems((prev) =>
          prev.map((item) =>
            item.id === event.data.id ? { ...item, content: event.data.content || item.content } : item,
          ),
        )
        toast({
          title: "Feedback Updated",
          description: "Another user updated feedback",
        })
        break

      case "feedback_voted":
        setFeedbackItems((prev) =>
          prev.map((item) =>
            item.id === event.data.id ? { ...item, vote_count: event.data.vote_count || item.vote_count } : item,
          ),
        )
        loadUserVotes()
        break
    }
  }
  const realtimeSync = useRealtimeSync({
    retrospectiveId: currentRetrospective?.id || null,
    onTimerEvent: handleTimerEvent,
    onFeedbackEvent: handleFeedbackEvent,
    pollInterval: 1000,
    enabled: !!currentRetrospective,
  })

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sessionId = urlParams.get("session")

    if (sessionId) {
      loadExistingRetrospective(sessionId)
    } else {
      initializeRetrospective()
    }
  }, [])

  useEffect(() => {
    if (currentRetrospective) {
      loadUserVotes()
    }
  }, [currentRetrospective])

  const loadExistingRetrospective = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/retrospectives/${sessionId}`)
      if (response.ok) {
        const retrospective = await response.json()
        setCurrentRetrospective(retrospective)
        setShareUrl(`${window.location.origin}?session=${retrospective.session_id}`)
        loadFeedbackItems(retrospective.id)
      } else {
        initializeRetrospective()
      }
    } catch (error) {
      console.error("Failed to load retrospective:", error)
      initializeRetrospective()
    } finally {
      setIsLoading(false)
    }
  }

  const initializeRetrospective = async () => {
    try {
      const response = await fetch("/api/retrospectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Retrospective Session" }),
      })

      if (response.ok) {
        const retrospective = await response.json()
        setCurrentRetrospective(retrospective)
        const newShareUrl = `${window.location.origin}?session=${retrospective.session_id}`
        setShareUrl(newShareUrl)
        window.history.pushState({}, "", newShareUrl)
        loadFeedbackItems(retrospective.id)
      }
    } catch (error) {
      console.error("Failed to initialize retrospective:", error)
      toast({
        title: "Error",
        description: "Failed to initialize retrospective session",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadFeedbackItems = async (retrospectiveId: number) => {
    try {
      const response = await fetch(`/api/retrospectives/${retrospectiveId}/feedback`)
      if (response.ok) {
        const items = await response.json()
        setFeedbackItems(items)
      }
    } catch (error) {
      console.error("Failed to load feedback items:", error)
    }
  }

  const handleAddFeedback = async (category: string, content: string) => {
    if (!currentRetrospective) return

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retrospective_id: currentRetrospective.id,
          category,
          content,
        }),
      })

      if (response.ok) {
        const newItem = await response.json()
        setFeedbackItems((prev) => [...prev, newItem])

        broadcastFeedbackEvent(
          createFeedbackEvent("feedback_added", currentRetrospective.id, {
            id: newItem.id,
            content: newItem.content,
            category: newItem.category,
            vote_count: newItem.vote_count,
          }),
        )

        toast({
          title: "Success",
          description: "Feedback added successfully",
        })
      }
    } catch (error) {
      console.error("Failed to add feedback:", error)
      toast({
        title: "Error",
        description: "Failed to add feedback",
        variant: "destructive",
      })
    }
  }

  const handleEditFeedback = async (id: number, content: string) => {
    if (!currentRetrospective) return

    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const updatedItem = await response.json()
        setFeedbackItems((prev) => prev.map((item) => (item.id === id ? updatedItem : item)))

        broadcastFeedbackEvent(
          createFeedbackEvent("feedback_updated", currentRetrospective.id, {
            id: updatedItem.id,
            content: updatedItem.content,
          }),
        )

        toast({
          title: "Success",
          description: "Feedback updated successfully",
        })
      }
    } catch (error) {
      console.error("Failed to edit feedback:", error)
      toast({
        title: "Error",
        description: "Failed to update feedback",
        variant: "destructive",
      })
    }
  }

  const handleVote = async (feedbackId: number) => {
    if (!currentRetrospective) return

    try {
      const deviceId = getDeviceId()
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_item_id: feedbackId,
          device_id: deviceId,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        if (data.action === "added") {
          setVotedItems((prev) => new Set([...prev, feedbackId]))
          toast({
            title: "Success",
            description: "Vote added successfully",
          })
        } else if (data.action === "removed") {
          setVotedItems((prev) => {
            const newSet = new Set(prev)
            newSet.delete(feedbackId)
            return newSet
          })
          toast({
            title: "Success",
            description: "Vote removed successfully",
          })
        }

        setFeedbackItems((prev) =>
          prev.map((item) => (item.id === feedbackId ? { ...item, vote_count: data.total_votes } : item)),
        )

        broadcastFeedbackEvent(
          createFeedbackEvent("feedback_voted", currentRetrospective.id, {
            id: feedbackId,
            vote_count: data.total_votes,
            action: data.action,
          }),
        )
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to process vote",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to vote:", error)
      toast({
        title: "Error",
        description: "Failed to process vote",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = async () => {
    const content = CATEGORIES.map((category) => {
      const items = feedbackItems.filter((item) => item.category === category.key)
      const itemsText = items.map((item) => `• ${item.content} (${item.vote_count} votes)`).join("\n")
      return `${category.title}\n${itemsText || "(No items)"}\n`
    }).join("\n")

    try {
      await navigator.clipboard.writeText(content)
      toast({
        title: "Success",
        description: "Retrospective content copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const startNewRetrospective = () => {
    setFeedbackItems([])
    setCurrentRetrospective(null)
    setVotedItems(new Set())
    timerRef.current?.resetTimer()
    initializeRetrospective()
    toast({
      title: "Success",
      description: "Started new retrospective session",
    })
  }

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: "Success",
        description: "Share URL copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL to clipboard",
        variant: "destructive",
      })
    }
  }

  const loadUserVotes = async () => {
    if (!currentRetrospective) return

    try {
      const deviceId = getDeviceId()
      const response = await fetch(`/api/votes/user?device_id=${deviceId}&retrospective_id=${currentRetrospective.id}`)
      if (response.ok) {
        const data = await response.json()
        setVotedItems(new Set(data.voted_items))
      }
    } catch (error) {
      console.error("Failed to load user votes:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600">Loading retrospective...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Session Controls</span>
              <div className="flex items-center gap-1">
                {realtimeSync.isConnected ? (
                  <Wifi className="w-4 h-4 text-green-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-600" />
                )}
                <span className="text-xs text-slate-500">
                  {realtimeSync.isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={copyToClipboard} variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-2" />
                Copy Feedback to Clipboard
              </Button>
              <Button onClick={startNewRetrospective} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Start New Retrospective
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TimerControls ref={timerRef} retrospectiveId={currentRetrospective?.id || null} />

          {shareUrl && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Share2 className="w-4 h-4 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Share this URL to share the retro:</p>
                <button
                  onClick={copyShareUrl}
                  className="flex items-center gap-2 mt-1 p-2 bg-white border border-blue-300 rounded-md hover:bg-blue-50 hover:border-blue-400 transition-colors group w-full text-left"
                >
                  <span className="text-sm text-blue-700 break-all flex-1">{shareUrl}</span>
                  <Copy className="w-4 h-4 text-blue-500 group-hover:text-blue-600 flex-shrink-0" />
                </button>
                <p className="text-xs text-blue-600 mt-1">Click above to copy</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {CATEGORIES.map((category) => (
          <FeedbackColumn
            key={category.key}
            title={category.title}
            category={category.key}
            color={category.color}
            items={feedbackItems.filter((item) => item.category === category.key)}
            onAddFeedback={handleAddFeedback}
            onEditFeedback={handleEditFeedback}
            onVote={handleVote}
            votedItems={votedItems}
          />
        ))}
      </div>
    </div>
  )
}
