/**
 * Memories 模块 - 记忆库管理
 * 
 * 提供记忆的添加、查询、搜索等功能
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * 获取所有记忆列表
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("memories").order("desc").collect();
  },
});

/**
 * 添加新记忆
 */
export const add = mutation({
  args: {
    content: v.string(),
    tags: v.array(v.string()),
    source: v.string(),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const memoryId = await ctx.db.insert("memories", {
      content: args.content,
      tags: args.tags,
      source: args.source,
      embedding: args.embedding,
      createdAt: Date.now(),
    });
    
    return { success: true, memoryId };
  },
});

/**
 * 按标签搜索记忆
 */
export const searchByTags = query({
  args: {
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const allMemories = await ctx.db.query("memories").collect();
    
    // 过滤包含指定标签的记忆
    return allMemories.filter(memory =>
      args.tags.some(tag => memory.tags.includes(tag))
    );
  },
});

/**
 * 按关键词搜索记忆 (简单文本搜索)
 */
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allMemories = await ctx.db.query("memories").collect();
    const searchQuery = args.query.toLowerCase();
    
    const results = allMemories.filter(memory =>
      memory.content.toLowerCase().includes(searchQuery) ||
      memory.tags.some(tag => tag.toLowerCase().includes(searchQuery)) ||
      memory.source.toLowerCase().includes(searchQuery)
    );
    
    // 按相关性排序并限制结果数量
    const limitedResults = args.limit
      ? results.slice(0, args.limit)
      : results;
    
    return limitedResults;
  },
});

/**
 * 删除记忆
 */
export const remove = mutation({
  args: {
    memoryId: v.id("memories"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.memoryId);
    return { success: true };
  },
});

/**
 * 获取最近记忆
 */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    return await ctx.db.query("memories").order("desc").take(limit);
  },
});
