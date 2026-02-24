"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskProgress } from "./TaskProgress";
import { SubTaskList, SubTask } from "./SubTaskList";
import { ActivityTimeline, ActivityLog } from "./ActivityTimeline";
import { TaskComments, Comment } from "./TaskComments";

export interface TaskWithDetails {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: string;
  assigneeName?: string;
  progress: number;
  dueDate?: number;
  parentId?: string;
  acceptorId?: string;
  acceptorName?: string;
  acceptanceStatus?: string;
  acceptanceFeedback?: string;
  tags?: string[];
  attachments?: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  subTasks?: SubTask[];
  comments?: Comment[];
  activityLogs?: ActivityLog[];
}

interface TaskDetailModalProps {
  task: TaskWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (taskId: string, updates: any) => Promise<void>;
  onUpdateStatus: (taskId: string, status: string) => Promise<void>;
  onUpdateProgress: (taskId: string, progress: number) => Promise<void>;
  onAddSubTask: (parentId: string, title: string) => Promise<void>;
  onToggleSubTask: (subTaskId: string, completed: boolean) => Promise<void>;
  onDeleteSubTask: (subTaskId: string) => Promise<void>;
  onAddComment: (taskId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onSubmitForAcceptance: (taskId: string) => Promise<void>;
  onAcceptTask: (taskId: string, acceptorName: string, feedback?: string) => Promise<void>;
  onRejectTask: (taskId: string, acceptorName: string, feedback: string) => Promise<void>;
  currentUserId?: string;
  currentUserName?: string;
}

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onUpdateTask,
  onUpdateStatus,
  onUpdateProgress,
  onAddSubTask,
  onToggleSubTask,
  onDeleteSubTask,
  onAddComment,
  onDeleteComment,
  onSubmitForAcceptance,
  onAcceptTask,
  onRejectTask,
  currentUserId,
  currentUserName,
}: TaskDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedPriority, setEditedPriority] = useState("");
  const [editedTags, setEditedTags] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  
  // 验收反馈
  const [acceptanceFeedback, setAcceptanceFeedback] = useState("");
  const [showAcceptanceDialog, setShowAcceptanceDialog] = useState(false);
  const [acceptanceAction, setAcceptanceAction] = useState<"accept" | "reject" | null>(null);

  useEffect(() => {
    if (task) {
      setEditedTitle(task.title);
      setEditedDescription(task.description || "");
      setEditedPriority(task.priority);
      setEditedTags(task.tags?.join(", ") || "");
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    const tagsArray = editedTags.split(",").map(t => t.trim()).filter(t => t);
    await onUpdateTask(task._id, {
      title: editedTitle,
      description: editedDescription,
      priority: editedPriority,
      tags: tagsArray,
    });
    setIsEditing(false);
  };

  const handleStatusChange = async (status: string) => {
    await onUpdateStatus(task._id, status);
  };

  const handleProgressChange = async (value: number) => {
    await onUpdateProgress(task._id, value);
  };

  const handleAddSubTask = async (title: string) => {
    await onAddSubTask(task._id, title);
  };

  const handleToggleSubTask = async (subTaskId: string, completed: boolean) => {
    await onToggleSubTask(subTaskId, completed);
  };

  const handleDeleteSubTask = async (subTaskId: string) => {
    await onDeleteSubTask(subTaskId);
  };

  const handleAddComment = async (content: string) => {
    await onAddComment(task._id, content);
  };

  const handleSubmitForAcceptance = async () => {
    await onSubmitForAcceptance(task._id);
  };

  const handleAccept = async () => {
    if (currentUserName) {
      await onAcceptTask(task._id, currentUserName, acceptanceFeedback);
      setShowAcceptanceDialog(false);
      setAcceptanceFeedback("");
    }
  };

  const handleReject = async () => {
    if (currentUserName && acceptanceFeedback.trim()) {
      await onRejectTask(task._id, currentUserName, acceptanceFeedback);
      setShowAcceptanceDialog(false);
      setAcceptanceFeedback("");
    }
  };

  const openAcceptanceDialog = (action: "accept" | "reject") => {
    setAcceptanceAction(action);
    setShowAcceptanceDialog(true);
  };

  const statusLabels: Record<string, string> = {
    todo: "待办",
    in_progress: "进行中",
    review: "审核",
    done: "完成",
  };

  const priorityLabels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
  };

  const acceptanceStatusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            {isEditing ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-xl font-bold"
                autoFocus
              />
            ) : (
              <DialogTitle className="text-xl">{task.title}</DialogTitle>
            )}
            
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button size="sm" onClick={handleSave}>保存</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>取消</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>✏️ 编辑</Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* 状态和进度 */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">状态:</span>
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">待办</SelectItem>
                  <SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="review">审核</SelectItem>
                  <SelectItem value="done">完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">优先级:</span>
              {isEditing ? (
                <Select value={editedPriority} onValueChange={setEditedPriority}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={task.priority === "high" ? "destructive" : "secondary"}>
                  {priorityLabels[task.priority]}
                </Badge>
              )}
            </div>
            
            {task.assigneeName && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">负责人:</span>
                <Badge variant="outline">👤 {task.assigneeName}</Badge>
              </div>
            )}
            
            {task.acceptanceStatus && (
              <div className={`px-2 py-1 rounded text-xs font-medium ${acceptanceStatusColors[task.acceptanceStatus]}`}>
                {task.acceptanceStatus === "pending" && "待验收"}
                {task.acceptanceStatus === "approved" && "已验收"}
                {task.acceptanceStatus === "rejected" && "已打回"}
              </div>
            )}
          </div>
          
          {/* 进度条 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">进度</span>
              <span className="text-sm text-muted-foreground">{task.progress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={task.progress}
              onChange={(e) => handleProgressChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">详情</TabsTrigger>
            <TabsTrigger value="subtasks">子任务 ({task.subTasks?.length || 0})</TabsTrigger>
            <TabsTrigger value="activity">活动</TabsTrigger>
            <TabsTrigger value="comments">评论 ({task.comments?.length || 0})</TabsTrigger>
          </TabsList>
          
          {/* 详情页 */}
          <TabsContent value="details" className="space-y-4">
            {isEditing ? (
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="任务描述..."
                className="min-h-[100px]"
              />
            ) : (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description || "无描述"}
              </div>
            )}
            
            {isEditing && (
              <div>
                <label className="text-sm font-medium mb-2 block">标签（逗号分隔）</label>
                <Input
                  value={editedTags}
                  onChange={(e) => setEditedTags(e.target.value)}
                  placeholder="标签 1, 标签 2, 标签 3"
                />
              </div>
            )}
            
            {!isEditing && task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">#{tag}</Badge>
                ))}
              </div>
            )}
            
            {/* 验收操作 */}
            {task.status !== "done" && task.acceptanceStatus !== "approved" && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">验收操作</h4>
                <div className="flex gap-2 flex-wrap">
                  {task.acceptanceStatus !== "pending" && (
                    <Button 
                      onClick={handleSubmitForAcceptance}
                      variant="outline"
                      size="sm"
                    >
                      📬 提交验收
                    </Button>
                  )}
                  
                  {task.acceptanceStatus === "pending" && (
                    <>
                      <Button 
                        onClick={() => openAcceptanceDialog("accept")}
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        ✅ 验收通过
                      </Button>
                      <Button 
                        onClick={() => openAcceptanceDialog("reject")}
                        variant="destructive"
                        size="sm"
                      >
                        ❌ 打回重做
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* 子任务页 */}
          <TabsContent value="subtasks">
            <SubTaskList
              subTasks={task.subTasks || []}
              onAddSubTask={handleAddSubTask}
              onToggleComplete={handleToggleSubTask}
              onDelete={handleDeleteSubTask}
            />
          </TabsContent>
          
          {/* 活动页 */}
          <TabsContent value="activity">
            <ActivityTimeline logs={task.activityLogs || []} />
          </TabsContent>
          
          {/* 评论页 */}
          <TabsContent value="comments">
            <TaskComments
              comments={task.comments || []}
              onAddComment={handleAddComment}
              onDeleteComment={onDeleteComment}
              currentUserId={currentUserId}
            />
          </TabsContent>
        </Tabs>

        {/* 验收对话框 */}
        {showAcceptanceDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-medium mb-4">
                {acceptanceAction === "accept" ? "验收通过" : "打回重做"}
              </h3>
              <Textarea
                value={acceptanceFeedback}
                onChange={(e) => setAcceptanceFeedback(e.target.value)}
                placeholder={acceptanceAction === "accept" ? "验收意见（可选）" : "打回原因（必填）"}
                className="mb-4"
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setShowAcceptanceDialog(false);
                    setAcceptanceFeedback("");
                  }}
                >
                  取消
                </Button>
                <Button
                  onClick={acceptanceAction === "accept" ? handleAccept : handleReject}
                  disabled={acceptanceAction === "reject" && !acceptanceFeedback.trim()}
                  variant={acceptanceAction === "accept" ? "default" : "destructive"}
                >
                  确认
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
