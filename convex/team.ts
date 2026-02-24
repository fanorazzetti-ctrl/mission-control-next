/**
 * Team 模块 - 团队配置管理
 * 
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
    return await ctx.db.query("teamConfig").collect();
  },
});

/**
 * 按角色获取团队成员
 */
export const getByRole = query({
  args: {
    role: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamConfig")
      .withIndex("by_role", q => q.eq("role", args.role))
      .collect();
  },
});

/**
 * 创建新团队成员
 */
export const create = mutation({
  args: {
    agentName: v.string(),
    role: v.string(),
    description: v.optional(v.string()),
    avatar: v.optional(v.string()),
    capabilities: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const memberId = await ctx.db.insert("teamConfig", {
      agentName: args.agentName,
      role: args.role,
      description: args.description,
      avatar: args.avatar,
      capabilities: args.capabilities,
      status: args.status,
    });
    
    return { success: true, memberId };
  },
});

/**
 * 更新团队成员信息
 */
export const update = mutation({
  args: {
    memberId: v.id("teamConfig"),
    agentName: v.optional(v.string()),
    role: v.optional(v.string()),
    description: v.optional(v.string()),
    avatar: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    
    if (!member) {
      return { success: false, error: "Member not found" };
    }
    
    const updates: any = {};
    if (args.agentName !== undefined) updates.agentName = args.agentName;
    if (args.role !== undefined) updates.role = args.role;
    if (args.description !== undefined) updates.description = args.description;
    if (args.avatar !== undefined) updates.avatar = args.avatar;
    if (args.capabilities !== undefined) updates.capabilities = args.capabilities;
    if (args.status !== undefined) updates.status = args.status;
    
    await ctx.db.patch(args.memberId, updates);
    
    return { success: true };
  },
});

/**
 * 删除团队成员
 */
export const remove = mutation({
  args: {
    memberId: v.id("teamConfig"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.memberId);
    return { success: true };
  },
});

/**
 * 获取单个成员详情
 */
export const get = query({
  args: {
    memberId: v.id("teamConfig"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.memberId);
  },
});

/**
 * 获取活跃成员
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("teamConfig")
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();
  },
});
