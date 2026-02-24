"use client";

import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export interface ActivityLog {
  _id: string;
  taskId: string;
  action: string;
  actorId: string;
  actorName: string;
  details: string;
  createdAt: number;
}

interface ActivityTimelineProps {
  logs: ActivityLog[];
}

const actionLabels: Record<string, string> = {
  created: "创建了任务",
  updated: "更新了任务",
  status_changed: "变更了状态",
  assigned: "分配了任务",
  progress_updated: "更新了进度",
  commented: "添加了评论",
  subtask_added: "添加了子任务",
  subtask_removed: "移除了子任务",
  submitted_for_acceptance: "提交了验收",
  accepted: "验收通过",
  rejected: "验收打回",
};

const actionIcons: Record<string, string> = {
  created: "✨",
  updated: "✏️",
  status_changed: "🔄",
  assigned: "👤",
  progress_updated: "📊",
  commented: "💬",
  subtask_added: "📝",
  subtask_removed: "🗑️",
  submitted_for_acceptance: "📬",
  accepted: "✅",
  rejected: "❌",
};

export function ActivityTimeline({ logs }: ActivityTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>暂无活动记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log, index) => {
        const details = JSON.parse(log.details || "{}");
        const actionLabel = actionLabels[log.action] || log.action;
        const icon = actionIcons[log.action] || "📌";

        return (
          <div key={log._id} className="relative flex gap-3">
            {/* 时间线 */}
            {index !== logs.length - 1 && (
              <div className="absolute left-3 top-8 bottom-0 w-px bg-border" />
            )}
            
            {/* 图标 */}
            <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
              {icon}
            </div>
            
            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{log.actorName}</span>
                <span className="text-sm text-muted-foreground">{actionLabel}</span>
              </div>
              
              {/* 详情 */}
              {renderDetails(log.action, details)}
              
              {/* 时间 */}
              <div className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(log.createdAt, { 
                  addSuffix: true,
                  locale: zhCN 
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderDetails(action: string, details: any) {
  switch (action) {
    case "status_changed":
      return (
        <div className="text-sm text-muted-foreground mt-1">
          <span className="bg-muted px-2 py-0.5 rounded mr-1">{details.from}</span>
          <span>→</span>
          <span className="bg-muted px-2 py-0.5 rounded ml-1">{details.to}</span>
        </div>
      );
    
    case "progress_updated":
      return (
        <div className="text-sm text-muted-foreground mt-1">
          进度：{details.from}% → {details.to}%
        </div>
      );
    
    case "commented":
      return (
        <div className="text-sm text-muted-foreground mt-1 bg-muted p-2 rounded">
          {details.content}
        </div>
      );
    
    case "subtask_added":
      return (
        <div className="text-sm text-muted-foreground mt-1">
          子任务：{details.title}
        </div>
      );
    
    case "accepted":
    case "rejected":
      if (details.feedback) {
        return (
          <div className="text-sm text-muted-foreground mt-1 bg-muted p-2 rounded">
            反馈：{details.feedback}
          </div>
        );
      }
      return null;
    
    default:
      return null;
  }
}
