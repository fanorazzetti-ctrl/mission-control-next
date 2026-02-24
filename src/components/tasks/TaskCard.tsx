"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskProgress } from "./TaskProgress";

export interface Task {
  _id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName?: string;
  progress?: number;
  subTaskCount?: number;
  acceptanceStatus?: string;
}

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onClick?: (task: Task) => void;
}

export function TaskCard({ task, onDelete, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
  };

  const acceptanceStatusIcons: Record<string, string> = {
    pending: "📬",
    approved: "✅",
    rejected: "❌",
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(task)}
      className={`hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isDragging ? "shadow-lg ring-2 ring-primary" : ""
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium leading-tight flex-1">{task.title}</h3>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityColors[task.priority]}`}
              title={`优先级：${task.priority}`}
            />
            {task.acceptanceStatus && (
              <span className="text-xs" title={`验收状态：${task.acceptanceStatus}`}>
                {acceptanceStatusIcons[task.acceptanceStatus]}
              </span>
            )}
          </div>
        </div>
        
        {task.assigneeName && (
          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
            <span>👤</span>
            <span>{task.assigneeName}</span>
          </p>
        )}
        
        {/* 进度条 */}
        {task.progress !== undefined && (
          <div className="mb-2">
            <TaskProgress progress={task.progress} showLabel={true} />
          </div>
        )}
        
        {/* 子任务数量 */}
        {task.subTaskCount !== undefined && task.subTaskCount > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            📝 {task.subTaskCount} 个子任务
          </p>
        )}
        
        <div className="flex gap-1 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task._id);
            }}
            className="h-7 text-xs text-destructive"
          >
            ✕ 删除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
