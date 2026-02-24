/**
 * Agents 模块 - Agent 状态管理
 * 
 * 提供 Agent 注册、状态更新、列表查询等功能
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * 注册新 Agent
 */
export const register = mutation({
  args: {
    agentName: v.string(),
    role: v.union(
      v.literal("developer"),
      v.literal("writer"),
      v.literal("designer"),
      v.literal("manager"),
      v.literal("assistant")
    ),
    capabilities: v.array(v.string()),
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("offline")
    ),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // 检查是否已存在
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_status", q => q.eq("status", args.status))
      .filter(q => q.eq(q.field("name"), args.agentName))
      .first();

    if (existing) {
      // 更新现有 Agent
      await ctx.db.patch(existing._id, {
        ...args,
        lastActiveAt: now,
      });
      return { success: true, action: "updated", agentId: existing._id };
    } else {
      // 创建新 Agent
      const agentId = await ctx.db.insert("agents", {
        name: args.agentName,
        role: args.role,
        status: args.status,
        capabilities: args.capabilities,
        avatarUrl: args.avatarUrl,
        lastActiveAt: now,
      });
      return { success: true, action: "created", agentId };
    }
  },
});

/**
 * 更新 Agent 状态
 */
export const updateStatus = mutation({
  args: {
    agentName: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("offline")
    ),
    currentTask: v.optional(v.string()),
    lastActiveAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.lastActiveAt || Date.now();
    
    // 查找 Agent
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_status")
      .filter(q => q.eq(q.field("name"), args.agentName))
      .first();

    if (!agent) {
      // Agent 不存在，自动注册为 assistant
      const agentId = await ctx.db.insert("agents", {
        name: args.agentName,
        role: "assistant",
        status: args.status,
        capabilities: [],
        lastActiveAt: now,
      });
      return { success: true, action: "auto-registered", agentId };
    }

    // 更新状态
    await ctx.db.patch(agent._id, {
      status: args.status,
      currentTaskId: args.currentTask ? agent.currentTaskId : undefined,
      lastActiveAt: now,
    });

    return { success: true, action: "updated", agentId: agent._id };
  },
});

/**
 * 更新当前任务
 */
export const updateCurrentTask = mutation({
  args: {
    agentName: v.string(),
    currentTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_status")
      .filter(q => q.eq(q.field("name"), args.agentName))
      .first();

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    await ctx.db.patch(agent._id, {
      currentTaskId: args.currentTaskId,
      status: args.currentTaskId ? "working" : "idle",
      lastActiveAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * 获取所有 Agent 列表
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

/**
 * 获取单个 Agent 信息
 */
export const get = query({
  args: {
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .filter(q => q.eq(q.field("name"), args.agentName))
      .first();
  },
});

/**
 * 获取指定状态的 Agent 列表
 */
export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("offline")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_status", q => q.eq("status", args.status))
      .collect();
  },
});

/**
 * 获取活跃 Agent 数量统计
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("agents").collect();
    
    return {
      total: all.length,
      idle: all.filter(a => a.status === "idle").length,
      working: all.filter(a => a.status === "working").length,
      offline: all.filter(a => a.status === "offline").length,
    };
  },
});
