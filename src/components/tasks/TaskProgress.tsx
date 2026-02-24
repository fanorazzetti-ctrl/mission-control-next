"use client";

import { Progress } from "@/components/ui/progress";

interface TaskProgressProps {
  progress: number;
  showLabel?: boolean;
  className?: string;
}

export function TaskProgress({ progress, showLabel = true, className = "" }: TaskProgressProps) {
  // 确保进度在 0-100 之间
  const safeProgress = Math.min(100, Math.max(0, progress));
  
  // 根据进度显示不同颜色
  const getColorClass = (progress: number) => {
    if (progress >= 100) return "bg-green-500";
    if (progress >= 75) return "bg-blue-500";
    if (progress >= 50) return "bg-yellow-500";
    return "bg-gray-400";
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Progress 
          value={safeProgress} 
          className={`h-2 ${getColorClass(safeProgress)}`}
        />
        {showLabel && (
          <span className="text-xs font-medium text-muted-foreground min-w-[3rem] text-right">
            {safeProgress}%
          </span>
        )}
      </div>
    </div>
  );
}
