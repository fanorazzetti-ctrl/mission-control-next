# Mission Control Next - Specification-Driven Development (SDD)

**项目名称**: Mission Control Next (OpenClaw 专属控制台)  
**文档目标**: 规范系统架构、数据模型、API 设计与开发路径，推动 OpenClaw 向可运营系统的转化。  
**技术栈**: Next.js 15 (App Router), React 19, Convex (BaaS), Tailwind CSS, shadcn/ui.

---

## 1. 系统架构概述

Mission Control Next 采用**客户端优先的响应式架构**，通过 Convex 实现前后端状态的实时同步。

- **前端层 (Frontend)**: 基于 Next.js 15 的 App Router 组织路由。使用 Tailwind CSS + shadcn/ui 构建高质量的交互界面（如看板、日历、仪表盘）。
- **数据层 (Backend & Real-time DB)**: 核心业务逻辑和数据库托管在 Convex 上。利用 Convex 的 WebSocket 特性实现任务看板、Agent 状态的无缝实时更新；使用 Convex Vector Search 支持记忆库的语义搜索；使用 Convex Cron Jobs 支持定期任务调度。
- **集成层 (Integration)**: 与 OpenClaw 核心通过 Convex Actions/HTTP Endpoints 进行通信，允许 Agent 读取任务、写入状态和查询记忆。

---

## 2. Convex Schema 设计

在 `convex/schema.ts` 中定义以下核心数据表和关系：

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // 1. Tasks Board (任务表)
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done")),
    assigneeId: v.optional(v.id("agents")), // 关联到具体 Agent 或用户
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    dueDate: v.optional(v.number()), // Unix Timestamp
  })
    .index("by_status", ["status"])
    .index("by_assignee", ["assigneeId"]),

  // 2. Calendar / Scheduled Tasks (日历/定时任务)
  scheduledEvents: defineTable({
    name: v.string(),
    cronExpression: v.string(),
    lastRun: v.optional(v.number()),
    nextRun: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("paused")),
    handler: v.string(), // 关联的执行逻辑标识
  }),

  // 3. Memory (记忆库)
  memories: defineTable({
    content: v.string(),
    tags: v.array(v.string()),
    embedding: v.optional(v.array(v.float64())), // 用于向量搜索
    source: v.string(), // 例如: "chat", "task_result", "manual"
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536, // 假设使用 OpenAI embeddings 维度
    filterFields: ["tags", "source"],
  }),

  // 4. Team (团队/Agent 结构)
  agents: defineTable({
    name: v.string(),
    role: v.union(v.literal("developer"), v.literal("writer"), v.literal("designer"), v.literal("manager")),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("offline")),
    currentTaskId: v.optional(v.id("tasks")),
    avatarUrl: v.optional(v.string()),
    capabilities: v.array(v.string()),
  }),

  // 5. Content Pipeline (内容流水线)
  contentPipeline: defineTable({
    title: v.string(),
    stage: v.union(v.literal("idea"), v.literal("script"), v.literal("thumbnail"), v.literal("filming"), v.literal("publish")),
    contentDraft: v.optional(v.string()),
    assets: v.optional(v.array(v.string())), // URL 列表
    relatedTaskId: v.optional(v.id("tasks")),
  }).index("by_stage", ["stage"]),
});
```

*(注：第 6 个模块 "Office" 主要作为前端视图层存在，数据来源于 `agents` 和 `tasks` 表的聚合查询。)*

---

## 3. API 端点设计 (Convex Functions)

- **Tasks Board**
  - `query: tasks:list` - 获取任务列表（可按状态过滤，支持看板渲染）。
  - `mutation: tasks:create` - 创建新任务。
  - `mutation: tasks:updateStatus` - 拖拽看板更新任务状态。
  - `mutation: tasks:assign` - 分配任务给特定 Agent。
- **Calendar**
  - `query: calendar:listEvents` - 获取定时任务及运行历史。
  - `mutation: calendar:toggleEvent` - 启用/暂停 Cron Job。
- **Memory**
  - `action: memory:search` - 接收查询字符串，生成 embedding 并进行 Vector Search，返回最相关的记忆。
  - `mutation: memory:add` - 记录新记忆。
- **Team & Office**
  - `query: agents:list` - 实时获取所有 Agent 状态（支持 Office 视图）。
  - `mutation: agents:updateStatus` - 供 Agent 本身调用以更新当前工作状态。
- **Content Pipeline**
  - `query: pipeline:list` - 获取各阶段的内容项。
  - `mutation: pipeline:advanceStage` - 将内容移动到下一阶段。

---

## 4. 前端页面结构 (Next.js App Router)

```text
app/
├── layout.tsx           # 全局 Layout，包含左侧边栏导航 (Sidebar)
├── page.tsx             # 【Office 模块】Dashboard 首页（大盘/Agent 实时工位图）
├── tasks/               # 【Tasks Board 模块】
│   └── page.tsx         # dnd-kit 或 react-beautiful-dnd 实现的看板界面
├── calendar/            # 【Calendar 模块】
│   └── page.tsx         # 日历视图与 Cron Job 列表
├── memory/              # 【Memory 模块】
│   └── page.tsx         # 搜索框 + 记忆流瀑布流展示
├── pipeline/            # 【Content Pipeline 模块】
│   └── page.tsx         # 创意到发布的内容阶段泳道图
└── team/                # 【Team 模块】
    └── page.tsx         # Agent 列表、角色配置与能力分配
```

---

## 5. 数据流说明

1. **实时响应 (Real-time Reactivity)**: UI 层通过 Convex `useQuery` 订阅数据。当有其他端（或 Agent）修改任务状态时，UI 自动无刷新重新渲染（例如 Tasks Board 实时同步）。
2. **乐观更新 (Optimistic Updates)**: 在执行看板拖拽（`mutation`）时，前端使用 Convex 的乐观更新机制，确保丝滑体验，无视网络延迟。
3. **Agent 接入 (Agent Integration)**: OpenClaw 的 Python/Node 核心通过 Convex HTTP Actions 定期轮询（或通过 WebSocket）获取被分配给它的 `todo` 任务。任务开始时调用 `agents:updateStatus` 变为 `working`，完成后自动生成报告写入 `memories`，并更新任务为 `done`。

---

## 6. 开发里程碑 (Milestones)

### Phase 1: 基础设施搭建 (Week 1)
- [x] 初始化 Next.js 15, Tailwind CSS, shadcn/ui。
- [x] 部署 Convex 并建立基础 Schema (`schema.ts`)。
- [x] 完成整体 Layout 布局（侧边栏、全局路由）。

### Phase 2: 核心优先级模块 (Week 1-2)
- [x] **Tasks Board**: 实现 Kanban UI，支持拖拽排序和状态变更；完成 Task 的 CRUD。
- [x] **Calendar**: 实现简单的任务列表与运行记录 UI（展示 Cron Tasks 审计数据）。
- [x] **Memory**: 完成文本记忆的录入和展示，接入 Convex Vector Search 实现基本语义检索。

### Phase 3: 业务扩展模块 (Week 3)
- [ ] **Content Pipeline**: 实现内容阶段的可视化管理（Idea -> Publish 流程）。
- [ ] **Team**: 实现 Agent 数据的基础管理面板。
- [ ] **Office**: 聚合 Task 与 Team 数据，利用 shadcn/ui Card 绘制 "数字工位"（实时展示哪个 Agent 正在做什么任务）。

### Phase 4: API 开放与联调 (Week 4)
- [ ] 暴露 Convex HTTP Actions 供 OpenClaw 本体直接调用（分配任务、读取记忆、回调状态）。
- [ ] 极端情况测试、UI 动画调优、性能优化。
