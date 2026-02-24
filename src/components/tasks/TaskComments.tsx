"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export interface Comment {
  _id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
}

interface TaskCommentsProps {
  comments: Comment[];
  onAddComment: (content: string) => void;
  onDeleteComment?: (commentId: string) => void;
  currentUserId?: string;
}

export function TaskComments({ 
  comments, 
  onAddComment,
  onDeleteComment,
  currentUserId 
}: TaskCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onAddComment(newComment);
      setNewComment("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 评论列表 */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无评论，快来添加第一条评论吧</p>
          </div>
        ) : (
          comments.map((comment) => (
            <Card key={comment._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{comment.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(comment.createdAt, { 
                          addSuffix: true,
                          locale: zhCN 
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                  
                  {/* 删除按钮（仅作者可删除） */}
                  {onDeleteComment && currentUserId && comment.authorId === currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteComment(comment._id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 添加评论 */}
      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="添加评论..."
          className="min-h-[80px]"
          disabled={isSubmitting}
        />
        <div className="flex justify-end">
          <Button 
            onClick={handleSubmit} 
            disabled={!newComment.trim() || isSubmitting}
            size="sm"
          >
            {isSubmitting ? "发送中..." : "发送评论"}
          </Button>
        </div>
      </div>
    </div>
  );
}
