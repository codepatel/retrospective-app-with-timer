"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FeedbackColumn } from "@/components/feedback-column"
import { TimerControls } from "@/components/timer-controls"
import { Copy, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FeedbackItem {
  id: number
  content: string
  category: string
  vote_count: number
  created_at: string
}

const CATEGORIES = [
  { key: "what_went_right", title: "What went right?", color: "bg-green-50 border-green-200" },
  { key: "what_can_improve", title: "What can we do better?", color: "bg-yellow-50 border-yellow-200" },
  { key: "risks", title: "What risks do we have?", color: "bg-red-50 border-red-200" },
  { key: "resolutions", title: "Possible resolutions...", color: "bg-blue-50 border-blue-200" },
]

export function RetrospectiveBoard() {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [currentRetrospectiveId, setCurrentRetrospectiveId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    initializeRetrospective()
  }, [])

  const initializeRetrospective = async () => {
    try {
      // Create a new retrospective session
      const response = await fetch("/api/retrospectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Retrospective Session" }),
      })

      if (response.ok) {
        const retrospective = await response.json()
        setCurrentRetrospectiveId(retrospective.id)
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
    if (!currentRetrospectiveId) return

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retrospective_id: currentRetrospectiveId,
          category,
          content,
        }),
      })

      if (response.ok) {
        const newItem = await response.json()
        setFeedbackItems((prev) => [...prev, newItem])
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
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const updatedItem = await response.json()
        setFeedbackItems((prev) => prev.map((item) => (item.id === id ? updatedItem : item)))
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
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback_item_id: feedbackId }),
      })

      if (response.ok) {
        // Reload feedback items to get updated vote counts
        if (currentRetrospectiveId) {
          loadFeedbackItems(currentRetrospectiveId)
        }
        toast({
          title: "Success",
          description: "Vote added successfully",
        })
      }
    } catch (error) {
      console.error("Failed to vote:", error)
      toast({
        title: "Error",
        description: "Failed to add vote",
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
    setCurrentRetrospectiveId(null)
    initializeRetrospective()
    toast({
      title: "Success",
      description: "Started new retrospective session",
    })
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
            <span>Session Controls</span>
            <div className="flex gap-2">
              <Button onClick={copyToClipboard} variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button onClick={startNewRetrospective} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Start New Retrospective
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimerControls />
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
          />
        ))}
      </div>
    </div>
  )
}
