# Convex Backend - Mission Control Next

## 部署状态 ✅

**部署时间**: 2026-02-23  
**部署 URL**: https://beaming-bandicoot-192.convex.cloud  
**状态**: 已成功部署

## 已部署的函数

### 📋 Tasks (任务管理) - 6 个函数

| 函数 | 类型 | 描述 |
|------|------|------|
| `list` | Query | 获取所有任务列表 |
| `getByStatus` | Query | 按状态获取任务 (todo/in_progress/review/done) |
| `create` | Mutation | 创建新任务 |
| `updateStatus` | Mutation | 更新任务状态 |
| `assign` | Mutation | 分配任务给 Agent |
| `remove` | Mutation | 删除任务 |
| `update` | Mutation | 更新任务内容 |

### 🤖 Agents (Agent 管理) - 7 个函数

| 函数 | 类型 | 描述 |
|------|------|------|
| `register` | Mutation | 注册新 Agent |
| `updateStatus` | Mutation | 更新 Agent 状态 (idle/working/offline) |
| `updateCurrentTask` | Mutation | 更新 Agent 当前任务 |
| `list` | Query | 获取所有 Agent 列表 |
| `get` | Query | 获取单个 Agent 信息 |
| `getByStatus` | Query | 获取指定状态的 Agent 列表 |
| `getStats` | Query | 获取 Agent 统计信息 |

### 🧠 Memories (记忆库) - 8 个函数

| 函数 | 类型 | 描述 |
|------|------|------|
| `list` | Query | 获取所有记忆列表 |
| `add` | Mutation | 添加新记忆（支持幂等） |
| `addBatch` | Mutation | 批量添加记忆 |
| `search` | Query | 按关键词/标签搜索记忆 |
| `existsByHash` | Query | 检查记忆是否已存在（按 hash） |
| `remove` | Mutation | 删除记忆 |
| `clearAll` | Mutation | 清空所有记忆（谨慎使用） |

### 📅 Calendar (日历/定时任务) - 7 个函数

| 函数 | 类型 | 描述 |
|------|------|------|
| `listEvents` | Query | 获取所有事件列表 |
| `toggleEvent` | Mutation | 切换事件状态 (active/paused) |
| `runEvent` | Mutation | 手动触发事件 |
| `create` | Mutation | 创建新事件 |
| `update` | Mutation | 更新事件 |
| `remove` | Mutation | 删除事件 |
| `getActive` | Query | 获取活跃事件 |

### 🔄 Pipeline (内容流水线) - 6 个函数

| 函数 | 类型 | 描述 |
|------|------|------|
| `list` | Query | 获取所有流水线项目 |
| `getByStage` | Query | 按阶段获取项目 (idea/script/thumbnail/filming/publish) |
| `create` | Mutation | 创建新项目 |
| `updateStage` | Mutation | 更新项目阶段 |
| `updateContent` | Mutation | 更新项目内容 |
| `remove` | Mutation | 删除项目 |
| `get` | Query | 获取项目详情 |

### 👥 Team (团队配置) - 6 个函数

| 函数 | 类型 | 描述 |
|------|------|------|
| `list` | Query | 获取所有团队成员列表 |
| `getByRole` | Query | 按角色获取成员 |
| `create` | Mutation | 创建新成员 |
| `update` | Mutation | 更新成员信息 |
| `remove` | Mutation | 删除成员 |
| `get` | Query | 获取成员详情 |
| `getActive` | Query | 获取活跃成员 |

## 数据表结构

### tasks
- 字段：title, description, status, assigneeId, assigneeName, priority, dueDate, createdAt, updatedAt
- 索引：by_status, by_assignee

### agents
- 字段：name, role, status, currentTaskId, avatarUrl, capabilities, lastActiveAt
- 索引：by_status, by_role

### memories
- 字段：content, tags, embedding, source, createdAt, **contentHash**（用于幂等导入）
- 索引：by_content_hash（唯一性检查）

### scheduledEvents
- 字段：name, cronExpression, lastRun, nextRun, status, handler, createdAt

### contentPipeline
- 字段：title, stage, contentDraft, assets, relatedTaskId, createdAt, updatedAt
- 索引：by_stage

### teamConfig
- 字段：agentName, role, description, avatar, capabilities, status
- 索引：by_role

## 使用示例

### React 客户端调用

```ts
// 获取任务列表
const tasks = useQuery(api.tasks.list);

// 创建任务
const createTask = useMutation(api.tasks.create);
createTask({
  title: "新任务",
  priority: "high",
  description: "任务描述"
});

// 更新任务状态
const updateStatus = useMutation(api.tasks.updateStatus);
updateStatus({ taskId: "xxx", status: "in_progress" });

// 获取活跃 Agent
const activeAgents = useQuery(api.agents.getByStatus, { status: "idle" });

// 添加记忆
const addMemory = useMutation(api.memories.add);
addMemory({
  content: "重要信息",
  tags: ["important", "note"],
  source: "user"
});
```

## 开发命令

```bash
# 开发模式 (实时同步)
npx convex dev

# 部署到生产环境
npx convex deploy

# 查看函数列表
npx convex function-spec

# 打开仪表盘
npx convex dashboard

# 查看日志
npx convex logs
```

## 📦 数据导入

### 导入 OpenClaw 记忆

将现有的 `memory/*.md` 和 `MEMORY.md` 文件导入到 Convex：

```bash
# 1. 预览导入结果
npx tsx scripts/import-data.ts --memories --dry-run

# 2. 实际导入
npx tsx scripts/import-data.ts --memories

# 3. 导入所有数据（记忆 + 任务，任务功能待实现）
npx tsx scripts/import-data.ts --all
```

**特性：**
- ✅ 幂等性：通过 content hash 避免重复导入
- ✅ 详细报告：显示导入进度和统计信息
- ✅ 自动标签：从文件名提取标签（如 `daily-log`, `error`, `learning` 等）

**详细说明：** 参见 `scripts/README-import.md`

---
