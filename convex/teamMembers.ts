/**
 * Team Members 模块 - 统一的团队成员管理
 * 
 * 合并了原 agents 和 teamConfig 的功能
 * 提供团队成员的创建、更新、删除、查询等功能
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * 获取所有团队成员列表
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teamMembers").collect();
  },
});

/**
 * 按状态获取团队成员
 */
export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("offline"),
      v.literal("active"),
      v.literal("inactive")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_status", q => q.eq("status", args.status))
      .collect();
  },
});

/**
 * 按角色获取团队成员
 */
export const getByRole = query({
  args: {
    role: v.union(
      v.literal("developer"),
      v.literal("writer"),
      v.literal("designer"),
      v.literal("manager"),
      v.literal("assistant")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_role", q => q.eq("role", args.role))
      .collect();
  },
});

/**
 * 按名称获取团队成员
 */
export const getByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_name", q => q.eq("name", args.name))
      .first();
  },
});

/**
 * 获取单个成员详情（通过 ID）
 */
export const get = query({
  args: {
    memberId: v.id("teamMembers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.memberId);
  },
});

/**
 * 创建新团队成员
 */
export const create = mutation({
  args: {
    name: v.string(),
    role: v.union(
      v.literal("developer"),
      v.literal("writer"),
      v.literal("designer"),
      v.literal("manager"),
      v.literal("assistant")
    ),
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("offline"),
      v.literal("active"),
      v.literal("inactive")
    ),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    capabilities: v.array(v.string()),
    currentTaskId: v.optional(v.id("tasks")),
    lastActiveAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // 检查是否已存在同名成员
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_name", q => q.eq("name", args.name))
      .first();

    if (existing) {
      return { 
        success: false, 
        error: "Member with this name already exists",
        memberId: existing._id 
      };
    }
    
    const memberId = await ctx.db.insert("teamMembers", {
      name: args.name,
      role: args.role,
      status: args.status,
      description: args.description,
      avatarUrl: args.avatarUrl,
      capabilities: args.capabilities,
      currentTaskId: args.currentTaskId,
      lastActiveAt: args.lastActiveAt || now,
      createdAt: now,
      updatedAt: now,
    });
    
    return { success: true, memberId };
  },
});

/**
 * 更新团队成员信息
 */
export const update = mutation({
  args: {
    memberId: v.id("teamMembers"),
    name: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("developer"),
      v.literal("writer"),
      v.literal("designer"),
      v.literal("manager"),
      v.literal("assistant")
    )),
    status: v.optional(v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("offline"),
      v.literal("active"),
      v.literal("inactive")
    )),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    currentTaskId: v.optional(v.id("tasks")),
    lastActiveAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    
    if (!member) {
      return { success: false, error: "Member not found" };
    }
    
    const updates: any = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.role !== undefined) updates.role = args.role;
    if (args.status !== undefined) updates.status = args.status;
    if (args.description !== undefined) updates.description = args.description;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
    if (args.capabilities !== undefined) updates.capabilities = args.capabilities;
    if (args.currentTaskId !== undefined) updates.currentTaskId = args.currentTaskId;
    if (args.lastActiveAt !== undefined) updates.lastActiveAt = args.lastActiveAt;
    
    await ctx.db.patch(args.memberId, updates);
    
    return { success: true };
  },
});

/**
 * 更新成员状态（快捷方法）
 */
export const updateStatus = mutation({
  args: {
    memberId: v.id("teamMembers"),
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("offline"),
      v.literal("active"),
      v.literal("inactive")
    ),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    
    if (!member) {
      return { success: false, error: "Member not found" };
    }
    
    await ctx.db.patch(args.memberId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    
    return { success: true };
  },
});

/**
 * 删除团队成员
 */
export const remove = mutation({
  args: {
    memberId: v.id("teamMembers"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.memberId);
    return { success: true };
  },
});

/**
 * 获取活跃成员统计
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("teamMembers").collect();
    
    return {
      total: all.length,
      idle: all.filter(m => m.status === "idle").length,
      working: all.filter(m => m.status === "working").length,
      offline: all.filter(m => m.status === "offline").length,
      active: all.filter(m => m.status === "active").length,
      inactive: all.filter(m => m.status === "inactive").length,
    };
  },
});

/**
 * 注册/更新 Agent（兼容原 agents.register）
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
      .query("teamMembers")
      .withIndex("by_name", q => q.eq("name", args.agentName))
      .first();

    if (existing) {
      // 更新现有成员
      await ctx.db.patch(existing._id, {
        role: args.role,
        status: args.status,
        capabilities: args.capabilities,
        avatarUrl: args.avatarUrl,
        lastActiveAt: now,
        updatedAt: now,
      });
      return { success: true, action: "updated", memberId: existing._id };
    } else {
      // 创建新成员
      const memberId = await ctx.db.insert("teamMembers", {
        name: args.agentName,
        role: args.role,
        status: args.status,
        capabilities: args.capabilities,
        avatarUrl: args.avatarUrl,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, action: "created", memberId };
    }
  },
});
