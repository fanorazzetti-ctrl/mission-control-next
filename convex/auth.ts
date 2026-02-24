/**
 * 认证授权模块
 * 
 * 提供用户认证、权限检查等功能
 * 
 * Note: Auth functionality requires proper @convex-dev/auth setup
 * Currently stubbed for MVP
 */

import { query } from "./_generated/server";

/**
 * 检查当前用户是否为管理员
 * TODO: Implement proper auth check
 */
export const isAdmin = query({
  args: {},
  handler: async (_ctx) => {
    // Stub for MVP - return true for development
    return true;
  },
});

/**
 * 获取当前登录用户信息
 * TODO: Implement proper auth check
 */
export const getCurrentUserQuery = query({
  args: {},
  handler: async (_ctx) => {
    // Stub for MVP
    return null;
  },
});
