"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { Task } from "@/components/tasks/TaskCard";
import { TaskDetailModal, TaskWithDetails } from "@/components/tasks/TaskDetailModal";
import { toast } from "sonner";

const statusColumns = [
  { id: "todo", title: "待办", color: "bg-gray-50 border-gray-200" },
  { id: "in_progress", title: "进行中", color: "bg-blue-50 border-blue-200" },
  { id: "review", title: "审核", color: "bg-yellow-50 border-yellow-200" },
  { id: "done", title: "完成", color: "bg-green-50 border-green-200" },
];

export default function TasksPage() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Convex queries
  const tasks = useQuery(api.tasks.list) || [];
  const agents = useQuery(api.agents.list) || [];

  // Convex mutations
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const updateProgress = useMutation(api.tasks.updateProgress);
  const addSubTask = useMutation(api.tasks.addSubTask);
  const removeSubTask = useMutation(api.tasks.removeSubTask);
  const addComment = useMutation(api.tasks.addComment);
  const removeComment = useMutation(api.tasks.removeComment);
  const submitForAcceptance = useMutation(api.tasks.submitForAcceptance);
  const acceptTask = useMutation(api.tasks.acceptTask);
  const rejectTask = useMutation(api.tasks.rejectTask);
  const deleteTask = useMutation(api.tasks.remove);
  const getWithDetails = useMutation(api.tasks.getWithDetails);

  // 模拟当前用户（实际应从认证系统获取）
  const currentUserId = "user-1";
  const currentUserName = "Arthur";

  // 转换任务数据格式
  const transformTasks = (tasks: any[]): Task[] => {
    return tasks.map(task => ({
      _id: task._id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assigneeName: task.assigneeName || "",
      progress: task.progress || 0,
      subTaskCount: 0, // 需要从子任务查询
      acceptanceStatus: task.acceptanceStatus,
    }));
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      await createTask({
        title: newTaskTitle,
        priority: "medium",
      });
      setNewTaskTitle("");
      console.log("任务创建成功");
    } catch (error) {
      toast.error("创建任务失败");
    }
  };

  const handleTaskClick = async (task: Task) => {
    try {
      // 获取任务详情
      const details = await getWithDetails({ taskId: task._id as Id<"tasks"> });
      if (details) {
        setSelectedTask(details);
        setIsModalOpen(true);
      }
    } catch (error) {
      toast.error("获取任务详情失败");
    }
  };

  const handleUpdateTask = async (taskId: string, updates: any) => {
    try {
      await updateTask({
        taskId: taskId as Id<"tasks">,
        ...updates,
        actorId: currentUserId,
        actorName: currentUserName,
      });
      toast.success("任务更新成功");
    } catch (error) {
      toast.error("更新任务失败");
    }
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    try {
      await updateStatus({
        taskId: taskId as Id<"tasks">,
        status: status as any,
        actorId: currentUserId,
        actorName: currentUserName,
      });
      toast.success("状态更新成功");
    } catch (error) {
      toast.error("更新状态失败");
    }
  };

  const handleUpdateProgress = async (taskId: string, progress: number) => {
    try {
      await updateProgress({
        taskId: taskId as Id<"tasks">,
        progress,
        actorId: currentUserId,
        actorName: currentUserName,
      });
    } catch (error) {
      toast.error("更新进度失败");
    }
  };

  const handleAddSubTask = async (parentId: string, title: string) => {
    try {
      await addSubTask({
        parentId: parentId as Id<"tasks">,
        title,
        priority: "medium",
      });
      toast.success("子任务添加成功");
    } catch (error) {
      toast.error("添加子任务失败");
    }
  };

  const handleToggleSubTask = async (subTaskId: string, completed: boolean) => {
    try {
      await updateStatus({
        taskId: subTaskId as Id<"tasks">,
        status: completed ? "done" : "todo",
        actorId: currentUserId,
        actorName: currentUserName,
      });
    } catch (error) {
      toast.error("更新子任务状态失败");
    }
  };

  const handleDeleteSubTask = async (subTaskId: string) => {
    try {
      await removeSubTask({
        subTaskId: subTaskId as Id<"tasks">,
        actorId: currentUserId,
        actorName: currentUserName,
      });
      toast.success("子任务删除成功");
    } catch (error) {
      toast.error("删除子任务失败");
    }
  };

  const handleAddComment = async (taskId: string, content: string) => {
    try {
      await addComment({
        taskId: taskId as Id<"tasks">,
        content,
        authorId: currentUserId,
        authorName: currentUserName,
      });
      toast.success("评论添加成功");
    } catch (error) {
      toast.error("添加评论失败");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await removeComment({
        commentId: commentId as Id<"taskComments">,
      });
      toast.success("评论删除成功");
    } catch (error) {
      toast.error("删除评论失败");
    }
  };

  const handleSubmitForAcceptance = async (taskId: string) => {
    try {
      await submitForAcceptance({
        taskId: taskId as Id<"tasks">,
        actorId: currentUserId,
        actorName: currentUserName,
      });
      toast.success("已提交验收");
    } catch (error) {
      toast.error("提交验收失败");
    }
  };

  const handleAcceptTask = async (taskId: string, acceptorName: string, feedback?: string) => {
    try {
      // 从 agents 列表获取第一个 agent 作为验收人
      const agent = agents[0];
      if (!agent) {
        toast.error("未找到验收人");
        return;
      }
      
      await acceptTask({
        taskId: taskId as Id<"tasks">,
        acceptorId: agent._id,
        acceptorName,
        feedback,
        actorId: currentUserId,
        actorName: currentUserName,
      });
      toast.success("验收通过");
    } catch (error) {
      toast.error("验收失败");
    }
  };

  const handleRejectTask = async (taskId: string, acceptorName: string, feedback: string) => {
    try {
      const agent = agents[0];
      if (!agent) {
        toast.error("未找到验收人");
        return;
      }
      
      await rejectTask({
        taskId: taskId as Id<"tasks">,
        acceptorId: agent._id,
        acceptorName,
        feedback,
        actorId: currentUserId,
        actorName: currentUserName,
      });
      toast.success("任务已打回");
    } catch (error) {
      toast.error("打回任务失败");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask({
        taskId: taskId as Id<"tasks">,
      });
      toast.success("任务删除成功");
    } catch (error) {
      toast.error("删除任务失败");
    }
  };

  const handleTaskMove = async (taskId: string, newStatus: string) => {
    await handleUpdateStatus(taskId, newStatus);
  };

  // 统计
  const getStats = (status: string) => {
    return tasks.filter((t: any) => t.status === status).length;
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">📋 任务看板</h1>
            <p className="text-muted-foreground mt-1">
              追踪任务和 Agent 工作状态，支持子任务、进度管理、验收流程
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="输入任务标题..."
              className="w-80"
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
            />
            <Button onClick={handleAddTask}>添加任务</Button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statusColumns.map((col) => (
            <Card key={col.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {col.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {getStats(col.id)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 拖拽看板 */}
        <TaskBoard
          tasks={transformTasks(tasks)}
          columns={statusColumns}
          onTaskMove={handleTaskMove}
          onTaskDelete={handleDeleteTask}
          onTaskClick={handleTaskClick}
        />

        {/* 功能说明 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">✨ 新功能特性</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <h4 className="font-medium mb-2">📊 进度管理</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>任务进度条（0-100%）</li>
                  <li>子任务自动计算进度</li>
                  <li>拖拽滑块快速更新进度</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">📝 子任务</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>创建父子任务关系</li>
                  <li>子任务完成度统计</li>
                  <li>子任务状态联动</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">✅ 验收流程</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>提交验收 → 待验收</li>
                  <li>验收通过/打回</li>
                  <li>验收意见反馈</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">💬 协作功能</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>任务评论</li>
                  <li>活动日志时间线</li>
                  <li>状态变更历史</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务详情 Modal */}
      <TaskDetailModal
        task={selectedTask}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUpdateTask={handleUpdateTask}
        onUpdateStatus={handleUpdateStatus}
        onUpdateProgress={handleUpdateProgress}
        onAddSubTask={handleAddSubTask}
        onToggleSubTask={handleToggleSubTask}
        onDeleteSubTask={handleDeleteSubTask}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onSubmitForAcceptance={handleSubmitForAcceptance}
        onAcceptTask={handleAcceptTask}
        onRejectTask={handleRejectTask}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />
    </main>
  );
}
