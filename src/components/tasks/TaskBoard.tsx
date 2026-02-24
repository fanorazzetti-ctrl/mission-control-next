"use client";

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Task } from "./TaskCard";
import { TaskColumn } from "./TaskColumn";

interface StatusColumn {
  id: string;
  title: string;
  color: string;
}

interface TaskBoardProps {
  tasks: Task[];
  columns: StatusColumn[];
  onTaskMove: (taskId: string, newStatus: string) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskClick?: (task: Task) => void;
}

export function TaskBoard({ tasks, columns, onTaskMove, onTaskDelete, onTaskClick }: TaskBoardProps) {
  // 配置拖拽传感器 - 使用 PointerSensor 支持鼠标和触摸
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 拖拽激活距离：5px，避免误触
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // 如果没有 drop 目标，直接返回
    if (!over) return;

    const taskId = active.id as string;
    
    // 查找任务当前所在列和目标列
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;

    // 获取目标列的 ID
    // over.id 可能是任务 ID（拖到任务上）或列 ID（拖到列上）
    // 我们需要找到对应的列
    let newStatus: string | null = null;

    // 检查 over 是否直接是列 ID
    const overColumn = columns.find((col) => col.id === over.id);
    if (overColumn) {
      newStatus = overColumn.id;
    } else {
      // 如果 over 是任务，找到该任务所在的列
      const overTask = tasks.find((t) => t._id === over.id);
      if (overTask) {
        newStatus = overTask.status;
      }
    }

    // 如果找到了新状态且与当前状态不同，执行移动
    if (newStatus && newStatus !== task.status) {
      onTaskMove(taskId, newStatus);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4">
        {columns.map((column) => (
          <TaskColumn
            key={column.id}
            column={column}
            tasks={tasks.filter((t) => t.status === column.id)}
            onDelete={onTaskDelete}
            onClick={onTaskClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
