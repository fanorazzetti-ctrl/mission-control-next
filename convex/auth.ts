/**
 * 认证授权模块
 * 
 * 提供用户认证、权限检查等功能
 */

import { convexAuth } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const { getCurrentUser, getAuthUserId, getSession } = convexAuth();

/**
 * 检查当前用户是否为管理员
 */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) return false;
    const userData = await ctx.db.get(userId);
    return userData?.role === "admin";
  },
});

/**
 * 获取当前登录用户信息
 */
export const getCurrentUserQuery = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
