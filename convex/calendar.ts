/**
 * Calendar 模块 - 日历/定时任务管理
 * 
 * 提供定时事件的创建、更新、删除、查询等功能
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * 获取所有事件列表
 */
export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("scheduledEvents").order("desc").collect();
  },
});

/**
 * 切换事件状态 (active/paused)
 */
export const toggleEvent = mutation({
  args: {
    eventId: v.id("scheduledEvents"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    
    if (!event) {
      return { success: false, error: "Event not found" };
    }
    
    const newStatus = event.status === "active" ? "paused" : "active";
    
    await ctx.db.patch(args.eventId, {
      status: newStatus,
    });
    
    return { success: true, newStatus };
  },
});

/**
 * 运行事件 (手动触发)
 */
export const runEvent = mutation({
  args: {
    eventId: v.id("scheduledEvents"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    
    if (!event) {
      return { success: false, error: "Event not found" };
    }
    
    const now = Date.now();
    
    await ctx.db.patch(args.eventId, {
      lastRun: now,
    });
    
    return { success: true, executedAt: now, handler: event.handler };
  },
});

/**
 * 创建新事件
 */
export const create = mutation({
  args: {
    name: v.string(),
    cronExpression: v.string(),
    handler: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // 简单计算下次运行时间 (实际项目应使用 cron 解析库)
    const nextRun = now + 60 * 60 * 1000; // 默认 1 小时后
    
    const eventId = await ctx.db.insert("scheduledEvents", {
      name: args.name,
      cronExpression: args.cronExpression,
      handler: args.handler,
      status: args.status || "active",
      nextRun,
      createdAt: now,
    });
    
    return { success: true, eventId };
  },
});

/**
 * 更新事件
 */
export const update = mutation({
  args: {
    eventId: v.id("scheduledEvents"),
    name: v.optional(v.string()),
    cronExpression: v.optional(v.string()),
    handler: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"))),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    
    if (!event) {
      return { success: false, error: "Event not found" };
    }
    
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.cronExpression !== undefined) updates.cronExpression = args.cronExpression;
    if (args.handler !== undefined) updates.handler = args.handler;
    if (args.status !== undefined) updates.status = args.status;
    
    await ctx.db.patch(args.eventId, updates);
    
    return { success: true };
  },
});

/**
 * 删除事件
 */
export const remove = mutation({
  args: {
    eventId: v.id("scheduledEvents"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.eventId);
    return { success: true };
  },
});

/**
 * 获取活跃事件
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("scheduledEvents")
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();
  },
});
