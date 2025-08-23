"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FeedbackItem } from "@/components/feedback-item"
import { Plus } from "lucide-react"

interface FeedbackItemType {
  id: number
  content: string
  category: string
  vote_count: number
  created_at: string
}

interface FeedbackColumnProps {
  title: string
  category: string
  color: string
  items: FeedbackItemType[]
  onAddFeedback: (category: string, content: string) => void
  onEditFeedback: (id: number, content: string) => void
  onVote: (feedbackId: number) => void
}

export function FeedbackColumn({
  title,
  category,
  color,
  items,
  onAddFeedback,
  onEditFeedback,
  onVote,
}: FeedbackColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newContent, setNewContent] = useState("")

  const handleSubmit = () => {
    if (newContent.trim()) {
      onAddFeedback(category, newContent.trim())
      setNewContent("")
      setIsAdding(false)
    }
  }

  const handleCancel = () => {
    setNewContent("")
    setIsAdding(false)
  }

  return (
    <Card className={`${color} border-2 h-fit`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Existing feedback items */}
        {items.map((item) => (
          <FeedbackItem key={item.id} item={item} onEdit={onEditFeedback} onVote={onVote} />
        ))}

        {/* Add new feedback form */}
        {isAdding ? (
          <div className="space-y-2">
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Enter your feedback..."
              className="min-h-[80px] resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleSubmit} size="sm" className="flex-1">
                Add
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm" className="flex-1 bg-transparent">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setIsAdding(true)}
            variant="outline"
            className="w-full border-dashed border-slate-300 hover:border-slate-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add feedback
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
