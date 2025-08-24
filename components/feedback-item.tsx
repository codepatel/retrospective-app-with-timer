"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ThumbsUp, Edit2, Check, X } from "lucide-react"

interface FeedbackItemType {
  id: number
  content: string
  category: string
  vote_count: number
  created_at: string
}

interface FeedbackItemProps {
  item: FeedbackItemType
  onEdit: (id: number, content: string) => void
  onVote: (feedbackId: number) => void
  hasVoted?: boolean
}

export function FeedbackItem({ item, onEdit, onVote, hasVoted = false }: FeedbackItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(item.content)

  const handleSave = () => {
    if (editContent.trim() && editContent !== item.content) {
      onEdit(item.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditContent(item.content)
    setIsEditing(false)
  }

  return (
    <Card className="bg-white/60 border border-slate-200 hover:bg-white/80 transition-colors">
      <CardContent className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-1">
              <Button onClick={handleSave} size="sm" variant="outline" className="h-7 px-2 bg-transparent">
                <Check className="w-3 h-3" />
              </Button>
              <Button onClick={handleCancel} size="sm" variant="outline" className="h-7 px-2 bg-transparent">
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">{item.content}</p>
            <div className="flex items-center justify-between">
              <Button
                onClick={() => onVote(item.id)}
                variant="ghost"
                size="sm"
                className={`h-7 px-2 transition-colors ${
                  hasVoted ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-slate-600 hover:text-blue-600"
                }`}
              >
                <ThumbsUp className={`w-3 h-3 mr-1 ${hasVoted ? "fill-current" : ""}`} />
                {item.vote_count}
              </Button>
              <Button
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-slate-600 hover:text-slate-800"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
