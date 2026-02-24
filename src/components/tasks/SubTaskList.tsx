"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { TaskProgress } from "./TaskProgress";

export interface SubTask {
  _id: string;
  title: string;
  status: string;
  progress: number;
  assigneeName?: string;
  priority: string;
}

interface SubTaskListProps {
  subTasks: SubTask[];
  onAddSubTask: (title: string) => void;
  onToggleComplete: (subTaskId: string, completed: boolean) => void;
  onDelete: (subTaskId: string) => void;
}

export function SubTaskList({ 
  subTasks, 
  onAddSubTask, 
  onToggleComplete,
  onDelete 
}: SubTaskListProps) {
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (!newSubTaskTitle.trim()) return;
    onAddSubTask(newSubTaskTitle);
    setNewSubTaskTitle("");
    setIsAdding(false);
  };

  // 计算完成度
  const completedCount = subTasks.filter(t => t.status === "done").length;
  const totalCount = subTasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const priorityColors: Record<string, string> = {
    high: "text-red-500",
    medium: "text-yellow-500",
    low: "text-green-500",
  };

  return (
    <div className="space-y-3">
      {/* 完成度统计 */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            已完成 {completedCount}/{totalCount}
          </span>
          <span className="font-medium">{completionRate}%</span>
        </div>
      )}

      {/* 子任务列表 */}
      <div className="space-y-2">
        {subTasks.map((subTask) => (
          <Card key={subTask._id} className={`transition-colors ${subTask.status === "done" ? "bg-muted/50" : ""}`}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                {/* 复选框 */}
                <Checkbox
                  checked={subTask.status === "done"}
                  onCheckedChange={(checked) => onToggleComplete(subTask._id, checked as boolean)}
                  className="mt-1"
                />
                
                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${subTask.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {subTask.title}
                    </span>
                    <span className={`text-xs ${priorityColors[subTask.priority]}`}>
                      ●
                    </span>
                  </div>
                  
                  {subTask.assigneeName && (
                    <div className="text-xs text-muted-foreground mt-1">
                      👤 {subTask.assigneeName}
                    </div>
                  )}
                  
                  {/* 进度条 */}
                  {subTask.status !== "done" && (
                    <TaskProgress progress={subTask.progress} showLabel={false} className="mt-2" />
                  )}
                </div>
                
                {/* 删除按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(subTask._id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  ✕
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 添加子任务 */}
      {isAdding ? (
        <div className="flex gap-2">
          <Input
            value={newSubTaskTitle}
            onChange={(e) => setNewSubTaskTitle(e.target.value)}
            placeholder="输入子任务标题..."
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
            autoFocus
          />
          <Button onClick={handleAdd} size="sm">添加</Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsAdding(false)}
          >
            取消
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="w-full"
        >
          + 添加子任务
        </Button>
      )}
    </div>
  );
}
