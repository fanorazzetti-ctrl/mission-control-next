/**
 * Pipeline 模块 - 内容流水线管理
 * 
 * 提供内容项目的创建、阶段更新、删除等功能
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * 获取所有流水线项目
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("contentPipeline").order("desc").collect();
  },
});

/**
 * 按阶段获取项目
 */
export const getByStage = query({
  args: {
    stage: v.union(
      v.literal("idea"),
      v.literal("script"),
      v.literal("thumbnail"),
      v.literal("filming"),
      v.literal("publish")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contentPipeline")
      .withIndex("by_stage", q => q.eq("stage", args.stage))
      .collect();
  },
});

/**
 * 创建新项目
 */
export const create = mutation({
  args: {
    title: v.string(),
    stage: v.union(
      v.literal("idea"),
      v.literal("script"),
      v.literal("thumbnail"),
      v.literal("filming"),
      v.literal("publish")
    ),
    contentDraft: v.optional(v.string()),
    assets: v.optional(v.array(v.string())),
    relatedTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const projectId = await ctx.db.insert("contentPipeline", {
      title: args.title,
      stage: args.stage,
      contentDraft: args.contentDraft,
      assets: args.assets,
      relatedTaskId: args.relatedTaskId,
      createdAt: now,
      updatedAt: now,
    });
    
    return { success: true, projectId };
  },
});

/**
 * 更新项目阶段
 */
export const updateStage = mutation({
  args: {
    projectId: v.id("contentPipeline"),
    stage: v.union(
      v.literal("idea"),
      v.literal("script"),
      v.literal("thumbnail"),
      v.literal("filming"),
      v.literal("publish")
    ),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    
    if (!project) {
      return { success: false, error: "Project not found" };
    }
    
    await ctx.db.patch(args.projectId, {
      stage: args.stage,
      updatedAt: Date.now(),
    });
    
    return { success: true, newStage: args.stage };
  },
});

/**
 * 更新项目内容
 */
export const updateContent = mutation({
  args: {
    projectId: v.id("contentPipeline"),
    contentDraft: v.optional(v.string()),
    assets: v.optional(v.array(v.string())),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    
    if (!project) {
      return { success: false, error: "Project not found" };
    }
    
    const updates: any = { updatedAt: Date.now() };
    if (args.contentDraft !== undefined) updates.contentDraft = args.contentDraft;
    if (args.assets !== undefined) updates.assets = args.assets;
    if (args.title !== undefined) updates.title = args.title;
    
    await ctx.db.patch(args.projectId, updates);
    
    return { success: true };
  },
});

/**
 * 删除项目
 */
export const remove = mutation({
  args: {
    projectId: v.id("contentPipeline"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.projectId);
    return { success: true };
  },
});

/**
 * 获取项目详情
 */
export const get = query({
  args: {
    projectId: v.id("contentPipeline"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});
