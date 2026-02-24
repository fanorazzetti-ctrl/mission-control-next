import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // 用户认证表
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // 1. Tasks Board (任务表)
  tasks: defineTable({
    // 现有字段
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
    assigneeId: v.optional(v.id("agents")),
    assigneeName: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    dueDate: v.optional(v.number()),
    
    // 新增字段 - 子任务功能
    parentId: v.optional(v.id("tasks")), // 父任务 ID（子任务关联）
    progress: v.number(), // 进度百分比 0-100
    
    // 新增字段 - 验收相关
    acceptorId: v.optional(v.id("agents")), // 验收人 ID
    acceptorName: v.optional(v.string()), // 验收人姓名
    acceptanceStatus: v.optional(v.union(
      v.literal("pending"), // 待验收
      v.literal("approved"), // 已验收
      v.literal("rejected") // 打回
    )),
    acceptanceFeedback: v.optional(v.string()), // 验收意见
    
    // 新增字段 - 标签和附件
    tags: v.optional(v.array(v.string())), // 标签
    attachments: v.optional(v.array(v.string())), // 附件 URL
    
    // 新增字段 - 任务来源和幂等检查 (2026-02-24)
    source: v.optional(v.union(
      v.literal("github"),
      v.literal("evolution"),
      v.literal("heartbeat"),
      v.literal("manual")
    )), // 任务来源
    contentHash: v.optional(v.string()), // 幂等检查 hash
    
    // 新增字段 - 验证相关 (2026-02-24)
    verificationStatus: v.optional(v.union(
      v.literal("pending"), // 待验证
      v.literal("passed"), // 验证通过
      v.literal("failed") // 验证失败
    )),
    verificationResult: v.optional(v.string()), // 验证结果详情
    verificationAttempts: v.number(), // 验证尝试次数
    
    // 时间戳
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()), // 完成时间
    
    // 超时检测字段
    startedAt: v.optional(v.number()), // 任务开始时间
    lastProgressAt: v.optional(v.number()), // 最后进展时间
    timeoutMinutes: v.optional(v.number()), // 超时阈值（分钟），默认 120
    
    // Agent 路由字段
    agentType: v.optional(v.union(
      v.literal("arthur"),
      v.literal("coder"),
      v.literal("researcher")
    )), // Agent 类型
  })
    .index("by_status", ["status"])
    .index("by_assignee", ["assigneeId"])
    .index("by_parent", ["parentId"]) // 子任务查询
    .index("by_acceptance", ["acceptanceStatus"])
    .index("by_source", ["source"]) // 按来源查询
    .index("by_content_hash", ["contentHash"]) // 幂等检查
    .index("by_verification", ["verificationStatus"]) // 验证状态查询
    .index("by_agent_type", ["agentType"]),

  // 2. Calendar / Scheduled Tasks (日历/定时任务)
  scheduledEvents: defineTable({
    name: v.string(),
    cronExpression: v.string(),
    lastRun: v.optional(v.number()),
    nextRun: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("paused")),
    handler: v.string(),
    createdAt: v.number(),
  }),

  // 3. Memory (记忆库)
  memories: defineTable({
    content: v.string(),
    tags: v.array(v.string()),
    embedding: v.optional(v.array(v.float64())),
    source: v.string(),
    createdAt: v.number(),
    contentHash: v.optional(v.string()), // 用于幂等导入
  })
    .index("by_content_hash", ["contentHash"]), // 唯一性检查

  // 4. Team Members (统一的团队成员表 - 合并 agents 和 teamConfig)
  teamMembers: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_role", ["role"])
    .index("by_name", ["name"]),

  // 5. Content Pipeline (内容流水线)
  contentPipeline: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_stage", ["stage"]),

  // 6. Team 团队配置
  teamConfig: defineTable({
    agentName: v.string(),
    role: v.string(),
    description: v.optional(v.string()),
    avatar: v.optional(v.string()),
    capabilities: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  }).index("by_role", ["role"]),

  // 7. Task Comments (任务评论) - 新增
  taskComments: defineTable({
    taskId: v.id("tasks"),
    authorId: v.string(),
    authorName: v.string(),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"]),

  // 8. Task Activity Logs (任务活动日志) - 新增
  taskActivityLogs: defineTable({
    taskId: v.id("tasks"),
    action: v.string(), // "created", "status_changed", "assigned", "commented", etc.
    actorId: v.string(),
    actorName: v.string(),
    details: v.string(), // JSON 字符串
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"]),
});
