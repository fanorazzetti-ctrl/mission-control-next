/**
 * Tasks 模块 - 任务管理
 * 
 * 提供任务创建、更新、删除、查询等功能
 * 支持子任务、进度管理、验收流程、评论、活动日志
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * 获取所有任务列表
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

/**
 * 按状态获取任务
 */
export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    return await ctx.db
      .query("tasks")
      .withIndex("by_status", q => q.eq("status", args.status))
      .collect();
  },
});

/**
 * 获取单个任务详情（包含子任务、评论、活动日志）
 */
export const getWithDetails = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    // 获取子任务
    const subTasks = await ctx.db
      .query("tasks")
      .withIndex("by_parent", q => q.eq("parentId", args.taskId))
      .collect();

    // 获取评论
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", q => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();

    // 获取活动日志
    const activityLogs = await ctx.db
      .query("taskActivityLogs")
      .withIndex("by_task", q => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();

    return {
      ...task,
      subTasks,
      comments,
      activityLogs,
    };
  },
});

/**
 * 创建新任务
 */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    assigneeId: v.optional(v.id("agents")),
    assigneeName: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    parentId: v.optional(v.id("tasks")), // 支持创建子任务
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const now = Date.now();
    
    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: "todo",
      priority: args.priority,
      assigneeId: args.assigneeId,
      assigneeName: args.assigneeName,
      dueDate: args.dueDate,
      parentId: args.parentId,
      progress: 0,
      tags: args.tags,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    });

    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId,
      action: "created",
      actorId: args.assigneeId || "system",
      actorName: args.assigneeName || "System",
      details: JSON.stringify({ title: args.title }),
      createdAt: now,
    });
    
    // 如果是子任务，更新父任务进度
    if (args.parentId) {
      await updateParentProgress(ctx, args.parentId);
    }
    
    return { success: true, taskId };
  },
});

/**
 * 更新任务状态
 */
export const updateStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const task = await ctx.db.get(args.taskId);
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: args.status,
      updatedAt: now,
      completedAt: args.status === "done" ? now : undefined,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "status_changed",
      actorId: args.actorId || "system",
      actorName: args.actorName || "System",
      details: JSON.stringify({ from: task.status, to: args.status }),
      createdAt: now,
    });
    
    // 如果是子任务，更新父任务进度
    if (task.parentId) {
      await updateParentProgress(ctx, task.parentId);
    }
    
    return { success: true };
  },
});

/**
 * 分配任务给 Agent
 */
export const assign = mutation({
  args: {
    taskId: v.id("tasks"),
    assigneeId: v.id("agents"),
    assigneeName: v.string(),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const task = await ctx.db.get(args.taskId);
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      assigneeId: args.assigneeId,
      assigneeName: args.assigneeName,
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "assigned",
      actorId: args.actorId || "system",
      actorName: args.actorName || "System",
      details: JSON.stringify({ assigneeId: args.assigneeId, assigneeName: args.assigneeName }),
      createdAt: now,
    });
    
    return { success: true };
  },
});

/**
 * 删除任务
 */
export const remove = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const task = await ctx.db.get(args.taskId);
    
    // 删除所有子任务
    const subTasks = await ctx.db
      .query("tasks")
      .withIndex("by_parent", q => q.eq("parentId", args.taskId))
      .collect();
    
    for (const subTask of subTasks) {
      await ctx.db.delete(subTask._id);
    }
    
    // 删除所有评论
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", q => q.eq("taskId", args.taskId))
      .collect();
    
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }
    
    // 删除所有活动日志
    const logs = await ctx.db
      .query("taskActivityLogs")
      .withIndex("by_task", q => q.eq("taskId", args.taskId))
      .collect();
    
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
    
    // 删除任务本身
    await ctx.db.delete(args.taskId);
    
    // 如果是子任务，更新父任务进度
    if (task?.parentId) {
      await updateParentProgress(ctx, task.parentId);
    }
    
    return { success: true };
  },
});

/**
 * 更新任务内容
 */
export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    )),
    dueDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.string())),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const task = await ctx.db.get(args.taskId);
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    const now = Date.now();
    const updates: any = { updatedAt: now };
    
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.attachments !== undefined) updates.attachments = args.attachments;
    
    await ctx.db.patch(args.taskId, updates);
    
    // 记录活动日志
    if (args.title || args.description || args.priority || args.dueDate) {
      await ctx.db.insert("taskActivityLogs", {
        taskId: args.taskId,
        action: "updated",
        actorId: args.actorId || "system",
        actorName: args.actorName || "System",
        details: JSON.stringify({ 
          title: args.title, 
          description: args.description,
          priority: args.priority,
          dueDate: args.dueDate 
        }),
        createdAt: now,
      });
    }
    
    return { success: true };
  },
});

/**
 * 更新任务进度（0-100%）
 */
export const updateProgress = mutation({
  args: {
    taskId: v.id("tasks"),
    progress: v.number(),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const task = await ctx.db.get(args.taskId);
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    if (args.progress < 0 || args.progress > 100) {
      return { success: false, error: "Progress must be between 0 and 100" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      progress: args.progress,
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "progress_updated",
      actorId: args.actorId || "system",
      actorName: args.actorName || "System",
      details: JSON.stringify({ from: task.progress, to: args.progress }),
      createdAt: now,
    });
    
    // 如果是子任务，更新父任务进度
    if (task.parentId) {
      await updateParentProgress(ctx, task.parentId);
    }
    
    return { success: true };
  },
});

/**
 * 添加子任务
 */
export const addSubTask = mutation({
  args: {
    parentId: v.id("tasks"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    assigneeId: v.optional(v.id("agents")),
    assigneeName: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const now = Date.now();
    
    const subTaskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: "todo",
      priority: args.priority,
      assigneeId: args.assigneeId,
      assigneeName: args.assigneeName,
      dueDate: args.dueDate,
      parentId: args.parentId,
      progress: 0,
      tags: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    });
    
    // 记录活动日志（父任务）
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.parentId,
      action: "subtask_added",
      actorId: args.assigneeId || "system",
      actorName: args.assigneeName || "System",
      details: JSON.stringify({ subTaskId, title: args.title }),
      createdAt: now,
    });
    
    // 更新父任务进度
    await updateParentProgress(ctx, args.parentId);
    
    return { success: true, subTaskId };
  },
});

/**
 * 删除子任务
 */
export const removeSubTask = mutation({
  args: {
    subTaskId: v.id("tasks"),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const subTask = await ctx.db.get(args.subTaskId);
    
    if (!subTask || !subTask.parentId) {
      return { success: false, error: "Not a subtask" };
    }
    
    // 删除子任务
    await ctx.db.delete(args.subTaskId);
    
    // 记录活动日志（父任务）
    await ctx.db.insert("taskActivityLogs", {
      taskId: subTask.parentId,
      action: "subtask_removed",
      actorId: args.actorId || "system",
      actorName: args.actorName || "System",
      details: JSON.stringify({ subTaskId: args.subTaskId, title: subTask.title }),
      createdAt: Date.now(),
    });
    
    // 更新父任务进度
    await updateParentProgress(ctx, subTask.parentId);
    
    return { success: true };
  },
});

/**
 * 提交任务验收
 */
export const submitForAcceptance = mutation({
  args: {
    taskId: v.id("tasks"),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const task = await ctx.db.get(args.taskId);
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "review",
      acceptanceStatus: "pending",
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "submitted_for_acceptance",
      actorId: args.actorId || "system",
      actorName: args.actorName || "System",
      details: JSON.stringify({}),
      createdAt: now,
    });
    
    return { success: true };
  },
});

/**
 * 验收通过
 */
export const acceptTask = mutation({
  args: {
    taskId: v.id("tasks"),
    acceptorId: v.id("agents"),
    acceptorName: v.string(),
    feedback: v.optional(v.string()),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      acceptorId: args.acceptorId,
      acceptorName: args.acceptorName,
      acceptanceStatus: "approved",
      acceptanceFeedback: args.feedback,
      status: "done",
      completedAt: now,
      progress: 100,
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "accepted",
      actorId: args.actorId || args.acceptorId,
      actorName: args.actorName || args.acceptorName,
      details: JSON.stringify({ feedback: args.feedback }),
      createdAt: now,
    });
    
    // 如果是子任务，更新父任务进度
    if (task.parentId) {
      await updateParentProgress(ctx, task.parentId);
    }
    
    return { success: true };
  },
});

/**
 * 验收打回
 */
export const rejectTask = mutation({
  args: {
    taskId: v.id("tasks"),
    acceptorId: v.id("agents"),
    acceptorName: v.string(),
    feedback: v.string(), // 打回必须提供反馈
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      acceptorId: args.acceptorId,
      acceptorName: args.acceptorName,
      acceptanceStatus: "rejected",
      acceptanceFeedback: args.feedback,
      status: "in_progress", // 打回后回到进行中
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "rejected",
      actorId: args.actorId || args.acceptorId,
      actorName: args.actorName || args.acceptorName,
      details: JSON.stringify({ feedback: args.feedback }),
      createdAt: now,
    });
    
    return { success: true };
  },
});

/**
 * 添加评论
 */
export const addComment = mutation({
  args: {
    taskId: v.id("tasks"),
    content: v.string(),
    authorId: v.string(),
    authorName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const commentId = await ctx.db.insert("taskComments", {
      taskId: args.taskId,
      content: args.content,
      authorId: args.authorId,
      authorName: args.authorName,
      createdAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "commented",
      actorId: args.authorId,
      actorName: args.authorName,
      details: JSON.stringify({ commentId, content: args.content }),
      createdAt: now,
    });
    
    return { success: true, commentId };
  },
});

/**
 * 删除评论
 */
export const removeComment = mutation({
  args: {
    commentId: v.id("taskComments"),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    
    if (!comment) {
      return { success: false, error: "Comment not found" };
    }
    
    await ctx.db.delete(args.commentId);
    
    return { success: true };
  },
});

/**
 * 获取活动日志
 */
export const getActivityLogs = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taskActivityLogs")
      .withIndex("by_task", q => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();
  },
});

/**
 * 获取子任务列表
 */
export const getSubTasks = query({
  args: {
    parentId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_parent", q => q.eq("parentId", args.parentId))
      .collect();
  },
});

/**
 * 检查超时任务
 */
export const checkTimeouts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    const tasks = await ctx.db.query("tasks").collect();
    const now = Date.now();
    
    const timeouts = tasks.filter(t => 
      t.status === "in_progress" &&
      t.lastProgressAt &&
      (now - t.lastProgressAt) > (t.timeoutMinutes || 120) * 60000
    );
    
    return timeouts;
  },
});

/**
 * 完成任务（触发通知）
 */
export const completeTask = mutation({
  args: {
    taskId: v.id("tasks"),
    actorId: v.string(),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "done",
      progress: 100,
      completedAt: now,
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "completed",
      actorId: args.actorId,
      actorName: args.actorName || "System",
      details: JSON.stringify({ completedAt: now }),
      createdAt: now,
    });
    
    // 如果是子任务，更新父任务进度
    if (task.parentId) {
      await updateParentProgress(ctx, task.parentId);
    }
    
    return { success: true, taskId: args.taskId };
  },
});

/**
 * 更新任务进展（更新 lastProgressAt）
 */
export const updateProgress = mutation({
  args: {
    taskId: v.id("tasks"),
    progress: v.number(),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const task = await ctx.db.get(args.taskId);
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    if (args.progress < 0 || args.progress > 100) {
      return { success: false, error: "Progress must be between 0 and 100" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      progress: args.progress,
      lastProgressAt: now,
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "progress_updated",
      actorId: args.actorId || "system",
      actorName: args.actorName || "System",
      details: JSON.stringify({ from: task.progress, to: args.progress }),
      createdAt: now,
    });
    
    // 如果是子任务，更新父任务进度
    if (task.parentId) {
      await updateParentProgress(ctx, task.parentId);
    }
    
    return { success: true };
  },
});

/**
 * 开始任务（设置 startedAt 和 lastProgressAt）
 */
export const startTask = mutation({
  args: {
    taskId: v.id("tasks"),
    actorId: v.string(),
    actorName: v.optional(v.string()),
    timeoutMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "in_progress",
      startedAt: now,
      lastProgressAt: now,
      timeoutMinutes: args.timeoutMinutes || 120,
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "started",
      actorId: args.actorId,
      actorName: args.actorName || "System",
      details: JSON.stringify({ timeoutMinutes: args.timeoutMinutes || 120 }),
      createdAt: now,
    });
    
    return { success: true };
  },
});

/**
 * 辅助函数：更新父任务进度（基于子任务完成度）
 */
async function updateParentProgress(ctx: any, parentId: Id<"tasks">) {
  const subTasks = await ctx.db
    .query("tasks")
    .withIndex("by_parent", q => q.eq("parentId", parentId))
    .collect();
  
  if (subTasks.length === 0) {
    return;
  }
  
  // 计算平均进度
  const totalProgress = subTasks.reduce((sum: number, task: any) => {
    // 如果子任务状态为 done，按 100% 计算
    if (task.status === "done") {
      return sum + 100;
    }
    return sum + (task.progress || 0);
  }, 0);
  
  const avgProgress = Math.round(totalProgress / subTasks.length);
  
  await ctx.db.patch(parentId, {
    progress: avgProgress,
    updatedAt: Date.now(),
  });
}
