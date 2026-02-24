"use client";

import { useDroppable } from "@dnd-kit/droppable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Task, TaskCard } from "./TaskCard";

interface StatusColumn {
  id: string;
  title: string;
  color: string;
}

interface TaskColumnProps {
  column: StatusColumn;
  tasks: Task[];
  onDelete: (id: string) => void;
  onClick?: (task: Task) => void;
}

export function TaskColumn({ column, tasks, onDelete, onClick }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <Card className={`h-full ${column.color} transition-colors ${isOver ? "ring-2 ring-primary" : ""}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          {column.title}
          <span className="ml-2 text-xs text-muted-foreground">({tasks.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={setNodeRef}
          className="space-y-2 min-h-[100px]"
        >
          {tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onDelete={onDelete}
              onClick={onClick}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
