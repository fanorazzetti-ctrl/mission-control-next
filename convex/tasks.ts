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
    // 新增字段 - 任务来源和幂等检查 (2026-02-24)
    source: v.optional(v.union(
      v.literal("github"),
      v.literal("evolution"),
      v.literal("heartbeat"),
      v.literal("manual")
    )),
    contentHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    const now = Date.now();
    
    // Check for duplicate if contentHash provided
    if (args.contentHash) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_content_hash", q => q.eq("contentHash", args.contentHash))
        .first();
      
      if (existing) {
        console.log(`Task with contentHash ${args.contentHash} already exists, skipping`);
        return { success: true, taskId: existing._id, skipped: true };
      }
    }
    
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
      source: args.source || "manual",
      contentHash: args.contentHash,
      verificationStatus: "pending",
      verificationResult: undefined,
      verificationAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });

    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId,
      action: "created",
      actorId: args.assigneeId || "system",
      actorName: args.assigneeName || "System",
      details: JSON.stringify({ title: args.title, source: args.source }),
      createdAt: now,
    });
    
    // 如果是子任务，更新父任务进度
    if (args.parentId) {
      await updateParentProgress(ctx, args.parentId);
    }
    
    return { success: true, taskId, skipped: false };
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
    const updates: any = {
      status: args.status,
      updatedAt: now,
    };
    
    // 如果状态变为 in_progress，设置 startedAt 和 lastProgressAt
    if (args.status === "in_progress") {
      updates.startedAt = now;
      updates.lastProgressAt = now;
      // 如果没有设置 timeoutMinutes，使用默认值
      if (!task.timeoutMinutes) {
        updates.timeoutMinutes = 120;
      }
    }
    
    // 如果状态变为 done，设置 completedAt 和 progress
    if (args.status === "done") {
      updates.completedAt = now;
      updates.progress = 100;
    }
    
    await ctx.db.patch(args.taskId, updates);
    
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
 * Agent 路由函数：根据任务属性确定执行 Agent 类型
 */
function routeToAgent(task: any): string {
  // 如果明确指定了 agentType，优先使用
  if (task.agentType) return task.agentType;
  
  // 根据标签智能路由
  if (task.tags?.includes("research")) return "researcher";
  if (task.tags?.includes("code")) return "coder";
  if (task.tags?.includes("data")) return "researcher";
  if (task.tags?.includes("analysis")) return "researcher";
  
  // 默认路由到 arthur
  return "arthur";
}

/**
 * 轮询待执行任务（心跳集成核心接口）
 * 
 * 获取第一个 todo 状态的任务，标记为 in_progress，记录活动日志
 * 支持按 agentType 过滤，只返回匹配的任务
 */
export const pollForExecution = mutation({
  args: { 
    agentType: v.string() // arthur/coder/researcher
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    const now = Date.now();
    
    // 获取所有 todo 状态的任务
    const todoTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", q => q.eq("status", "todo"))
      .order("asc")
      .collect();
    
    // 过滤出匹配 agentType 的任务
    const matchingTasks = todoTasks.filter(task => {
      const routedAgent = routeToAgent(task);
      return routedAgent === args.agentType;
    });
    
    // 没有匹配的任务
    if (matchingTasks.length === 0) {
      return { success: false, task: null, reason: "no_matching_tasks" };
    }
    
    // 获取第一个任务（最早创建的）
    const task = matchingTasks[0];
    
    // 标记为 in_progress
    await ctx.db.patch(task._id, {
      status: "in_progress",
      startedAt: now,
      lastProgressAt: now,
      timeoutMinutes: task.timeoutMinutes || 120,
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: task._id,
      action: "picked_by_heartbeat",
      actorId: userId,
      actorName: `Heartbeat Poller (${args.agentType})`,
      details: JSON.stringify({ 
        agentType: args.agentType,
        pickedAt: now,
        routedBy: routeToAgent(task)
      }),
      createdAt: now,
    });
    
    return { 
      success: true, 
      task: {
        ...task,
        status: "in_progress",
        startedAt: now,
        lastProgressAt: now,
      },
      routedBy: routeToAgent(task)
    };
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

/**
 * 蜂群框架：分解复杂任务为子任务
 * 根据任务类型自动分解为 research/development/analysis/generic 子任务
 */
export const decomposeTask = mutation({
  args: {
    taskId: v.id("tasks"),
    decompositionType: v.optional(v.union(
      v.literal("auto"),
      v.literal("research"),
      v.literal("development"),
      v.literal("analysis"),
      v.literal("generic")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    const parentTask = await ctx.db.get(args.taskId);
    if (!parentTask) {
      return { success: false, error: "Task not found" };
    }
    
    // 检查是否已有子任务
    const existingSubTasks = await ctx.db
      .query("tasks")
      .withIndex("by_parent", q => q.eq("parentId", args.taskId))
      .collect();
    
    if (existingSubTasks.length > 0) {
      return { 
        success: false, 
        error: "Task already has subtasks",
        subTasks: existingSubTasks 
      };
    }
    
    const now = Date.now();
    const subTasks: any[] = [];
    
    // 根据任务类型或标签确定分解策略
    let decompType = args.decompositionType;
    if (!decompType || decompType === "auto") {
      // 根据标签自动判断
      const tags = parentTask.tags || [];
      if (tags.includes("research") || tags.includes("survey")) {
        decompType = "research";
      } else if (tags.includes("development") || tags.includes("coding")) {
        decompType = "development";
      } else if (tags.includes("analysis") || tags.includes("data")) {
        decompType = "analysis";
      } else {
        decompType = "generic";
      }
    }
    
    // 根据分解类型创建子任务
    switch (decompType) {
      case "research":
        // 研究型任务分解
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `📚 文献调研：${parentTask.title}`,
            description: "收集和分析相关文献、论文、技术文档",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "research", "literature_review"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `🔍 技术调研：${parentTask.title}`,
            description: "调研现有技术栈、工具、框架",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "research", "technical_survey"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `📊 竞品分析：${parentTask.title}`,
            description: "分析类似项目、竞品、最佳实践",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "research", "competitive_analysis"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        break;
        
      case "development":
        // 开发型任务分解
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `🏗️ 架构设计：${parentTask.title}`,
            description: "设计系统架构、接口规范、数据模型",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "development", "architecture"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `💻 核心实现：${parentTask.title}`,
            description: "实现核心功能模块",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "development", "implementation"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `🧪 测试验证：${parentTask.title}`,
            description: "编写测试用例、执行测试、修复 bug",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "development", "testing"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        break;
        
      case "analysis":
        // 分析型任务分解
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `📈 数据收集：${parentTask.title}`,
            description: "收集原始数据、清洗、预处理",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "analysis", "data_collection"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `🔬 数据分析：${parentTask.title}`,
            description: "统计分析、模式识别、可视化",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "analysis", "data_analysis"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `📝 报告撰写：${parentTask.title}`,
            description: "撰写分析报告、结论建议",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "analysis", "reporting"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        break;
        
      case "generic":
      default:
        // 通用型任务分解
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `📋 需求分析：${parentTask.title}`,
            description: "明确需求、范围、验收标准",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "planning"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `⚙️ 执行实施：${parentTask.title}`,
            description: "执行主要工作任务",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "execution"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        subTasks.push(
          await ctx.db.insert("tasks", {
            title: `✅ 验收交付：${parentTask.title}`,
            description: "验收测试、文档整理、交付",
            status: "todo",
            priority: parentTask.priority,
            parentId: args.taskId,
            progress: 0,
            tags: ["subtask", "delivery"],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          })
        );
        break;
    }
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "decomposed",
      actorId: "system",
      actorName: "Swarm Framework",
      details: JSON.stringify({ 
        decompositionType: decompType,
        subTaskCount: subTasks.length 
      }),
      createdAt: now,
    });
    
    // 更新父任务标签
    const updatedTags = [...(parentTask.tags || []), "swarm_parent", "decomposed"];
    await ctx.db.patch(args.taskId, {
      tags: updatedTags,
      updatedAt: now,
    });
    
    // 更新父任务进度（初始为 0）
    await updateParentProgress(ctx, args.taskId);
    
    return { 
      success: true, 
      subTasks: subTasks.map(id => ({ id, type: decompType })),
      decompositionType: decompType
    };
  },
});

/**
 * 蜂群框架：聚合子任务结果
 * 当所有子任务完成后，聚合结果并标记父任务为 done
 */
export const aggregateResults = mutation({
  args: {
    parentId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    const parentTask = await ctx.db.get(args.parentId);
    if (!parentTask) {
      return { success: false, error: "Parent task not found" };
    }
    
    // 获取所有子任务
    const subTasks = await ctx.db
      .query("tasks")
      .withIndex("by_parent", q => q.eq("parentId", args.parentId))
      .collect();
    
    if (subTasks.length === 0) {
      return { 
        success: false, 
        error: "No subtasks found",
        isComplete: true // 没有子任务，视为已完成
      };
    }
    
    // 检查是否所有子任务都已完成
    const incompleteTasks = subTasks.filter(t => t.status !== "done");
    
    if (incompleteTasks.length > 0) {
      return { 
        success: false, 
        error: "Not all subtasks completed",
        completedCount: subTasks.length - incompleteTasks.length,
        totalCount: subTasks.length,
        incompleteTasks: incompleteTasks.map(t => ({ id: t._id, title: t.title, status: t.status }))
      };
    }
    
    const now = Date.now();
    
    // 聚合子任务结果（收集所有子任务的描述和标签）
    const aggregatedInfo = {
      totalSubTasks: subTasks.length,
      completedAt: now,
      subTaskSummary: subTasks.map(t => ({
        title: t.title,
        description: t.description,
        tags: t.tags,
      })),
      combinedTags: [...new Set(subTasks.flatMap(t => t.tags || []))],
    };
    
    // 更新父任务为 done
    await ctx.db.patch(args.parentId, {
      status: "done",
      progress: 100,
      completedAt: now,
      updatedAt: now,
      acceptanceStatus: "approved",
      acceptanceFeedback: `蜂群框架自动验收：所有 ${subTasks.length} 个子任务已完成`,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.parentId,
      action: "aggregated",
      actorId: "system",
      actorName: "Swarm Framework",
      details: JSON.stringify(aggregatedInfo),
      createdAt: now,
    });
    
    // 计算贡献度（用于 bounty 分配）
    const contributionRatios = subTasks.map(t => {
      // 简单按子任务复杂度（这里用优先级代表）分配
      let weight = 1;
      if (t.priority === "high") weight = 3;
      else if (t.priority === "medium") weight = 2;
      
      return {
        taskId: t._id,
        title: t.title,
        assigneeId: t.assigneeId,
        assigneeName: t.assigneeName,
        weight,
      };
    });
    
    const totalWeight = contributionRatios.reduce((sum, r) => sum + r.weight, 0);
    const contributionWithRatio = contributionRatios.map(r => ({
      ...r,
      ratio: Math.round((r.weight / totalWeight) * 100),
    }));
    
    return { 
      success: true,
      aggregatedInfo,
      contributionRatios: contributionWithRatio,
      message: `成功聚合 ${subTasks.length} 个子任务结果，父任务已标记为完成`
    };
  },
});

/**
 * 蜂群框架：检查并自动聚合
 * 查询所有已分解但未聚合的父任务，自动触发聚合
 */
export const autoAggregate = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    // 查找所有标记为 swarm_parent 但未完成的任务
    const allTasks = await ctx.db.query("tasks").collect();
    const swarmParents = allTasks.filter(t => 
      t.tags?.includes("swarm_parent") && 
      t.status !== "done"
    );
    
    const aggregatedTasks: any[] = [];
    
    for (const parent of swarmParents) {
      // 检查子任务是否全部完成
      const subTasks = await ctx.db
        .query("tasks")
        .withIndex("by_parent", q => q.eq("parentId", parent._id))
        .collect();
      
      if (subTasks.length > 0 && subTasks.every(t => t.status === "done")) {
        // 所有子任务完成，触发聚合
        const result = await aggregateResults.handler(ctx, { parentId: parent._id });
        if (result.success) {
          aggregatedTasks.push({
            parentId: parent._id,
            parentTitle: parent.title,
            subTaskCount: subTasks.length,
          });
        }
      }
    }
    
    return {
      success: true,
      aggregatedCount: aggregatedTasks.length,
      aggregatedTasks,
    };
  },
});

// ============================================================================
// 闭环验证机制 (2026-02-24)
// ============================================================================

/**
 * 验证任务完成结果
 * 
 * 验证失败 → 重新进入 todo
 * 验证通过 → done
 */
export const verifyTask = mutation({
  args: { 
    taskId: v.id("tasks"),
    verificationResult: v.string(),
    passed: v.boolean(),
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
    const newAttemptCount = (task.verificationAttempts || 0) + 1;
    
    // 更新验证状态
    await ctx.db.patch(args.taskId, {
      verificationStatus: args.passed ? "passed" : "failed",
      verificationResult: args.verificationResult,
      verificationAttempts: newAttemptCount,
      updatedAt: now,
    });
    
    if (args.passed) {
      // 验证通过 → done
      await ctx.db.patch(args.taskId, {
        status: "done",
        completedAt: now,
        progress: 100,
      });
      
      console.log(`✅ Task ${args.taskId} verified successfully (attempt ${newAttemptCount})`);
    } else {
      // 验证失败 → 重新进入 todo
      await ctx.db.patch(args.taskId, {
        status: "todo",
        progress: 0,
      });
      
      console.log(`❌ Task ${args.taskId} verification failed (attempt ${newAttemptCount})`);
      
      // 如果验证失败超过 3 次，标记为需要人工介入
      if (newAttemptCount >= 3) {
        const currentTags = task.tags || [];
        if (!currentTags.includes("needs-human-intervention")) {
          await ctx.db.patch(args.taskId, {
            tags: [...currentTags, "needs-human-intervention", "verification-failed"],
          });
          console.log(`⚠️ Task ${args.taskId} marked for human intervention after ${newAttemptCount} failed attempts`);
        }
      }
    }
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: args.passed ? "verified" : "verification_failed",
      actorId: args.actorId || "system",
      actorName: args.actorName || "System",
      details: JSON.stringify({ 
        passed: args.passed, 
        result: args.verificationResult,
        attempt: newAttemptCount 
      }),
      createdAt: now,
    });
    
    // 如果是子任务，更新父任务进度
    if (task.parentId) {
      await updateParentProgress(ctx, task.parentId);
    }
    
    return { 
      success: true, 
      passed: args.passed,
      attempts: newAttemptCount,
    };
  },
});

/**
 * 查询需要验证的任务
 */
export const getTasksNeedingVerification = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    const allTasks = await ctx.db.query("tasks").collect();
    const needsVerification = allTasks.filter(t => 
      t.status === "done" && 
      t.verificationStatus !== "passed"
    );
    
    return needsVerification.slice(0, args.limit || 10);
  },
});

/**
 * 获取验证统计
 */
export const getVerificationStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new Error("Unauthorized: Please log in");
    
    const allTasks = await ctx.db.query("tasks").collect();
    
    const stats = {
      total: allTasks.length,
      verified: allTasks.filter(t => t.verificationStatus === "passed").length,
      failed: allTasks.filter(t => t.verificationStatus === "failed").length,
      pending: allTasks.filter(t => t.verificationStatus === "pending" || !t.verificationStatus).length,
      needsHumanIntervention: allTasks.filter(t => t.tags?.includes("needs-human-intervention")).length,
    };
    
    return stats;
  },
});

/**
 * 标记任务完成并触发验证
 * 
 * 任务执行完成后调用此函数，自动进入验证流程
 */
export const completeTaskAndVerify = mutation({
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
    
    // 更新状态为 done，但 verificationStatus 为 pending
    await ctx.db.patch(args.taskId, {
      status: "done",
      completedAt: now,
      progress: 100,
      verificationStatus: "pending",
      updatedAt: now,
    });
    
    // 记录活动日志
    await ctx.db.insert("taskActivityLogs", {
      taskId: args.taskId,
      action: "completed_pending_verification",
      actorId: args.actorId || "system",
      actorName: args.actorName || "System",
      details: JSON.stringify({}),
      createdAt: now,
    });
    
    return { success: true };
  },
});
