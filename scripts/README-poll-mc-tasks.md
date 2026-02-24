# Mission Control 任务轮询脚本使用说明

## 📖 概述

`poll-mc-tasks.ts` 是 Mission Control 心跳集成的核心脚本，负责：
- 轮询 Convex 任务队列
- 根据 Agent 类型智能路由任务
- 启动对应 sub-agent 执行任务
- 追踪执行状态

## 🚀 快速开始

### 1. 基础使用（Mock 模式）

```bash
cd ~/openclaw/workspace/mission-control-next
npx tsx scripts/poll-mc-tasks.ts
```

输出示例：
```
🫀 Mission Control Task Poller - Starting...

⚠️  Convex URL not configured - Running in MOCK mode

🔍 Polling for arthur...
   [MOCK] Would poll for arthur
   No tasks available for arthur (mock_mode)

🔍 Polling for coder...
   [MOCK] Would poll for coder
   No tasks available for coder (mock_mode)

🔍 Polling for researcher...
   [MOCK] Would poll for researcher
   No tasks available for researcher (mock_mode)

📊 Poll Summary:
   Total tasks picked (session): 0
   Last poll: never

✅ Mission Control Task Poller - Complete
```

### 2. 生产模式（需要 Convex 部署）

```bash
# 设置 Convex URL
export CONVEX_URL=https://strong-toad-476.convex.cloud

# 执行轮询
npx tsx scripts/poll-mc-tasks.ts
```

## 🧠 Agent 路由规则

| 条件 | 路由到 | 示例 |
|------|--------|------|
| `agentType` 明确指定 | 指定类型 | `{agentType: "coder"}` → coder |
| 标签包含 `research` | researcher | `{tags: ["research"]}` → researcher |
| 标签包含 `data` | researcher | `{tags: ["data"]}` → researcher |
| 标签包含 `analysis` | researcher | `{tags: ["analysis"]}` → researcher |
| 标签包含 `code` | coder | `{tags: ["code"]}` → coder |
| 无匹配 | arthur | `{}` → arthur (默认) |

## 📝 创建测试任务

### 方法 1: 使用 Convex Dashboard

1. 访问 https://strong-toad-476.convex.cloud
2. 进入 `tasks` 表
3. 点击 "Insert"
4. 填写任务信息：
   ```json
   {
     "title": "测试任务 - 路由到 coder",
     "description": "这是一个测试任务",
     "status": "todo",
     "priority": "medium",
     "tags": ["code"],
     "createdAt": 1708732800000,
     "updatedAt": 1708732800000
   }
   ```

### 方法 2: 使用 Node.js 脚本

创建 `scripts/create-test-task.ts`:

```typescript
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convex = new ConvexClient(process.env.CONVEX_URL!);

async function createTestTask() {
  const result = await convex.mutation(api.tasks.create, {
    title: "测试任务 - 路由到 coder",
    description: "这是一个测试任务",
    priority: "medium",
    tags: ["code"],
  });
  
  console.log("✅ Task created:", result);
}

createTestTask().catch(console.error);
```

执行：
```bash
export CONVEX_URL=https://strong-toad-476.convex.cloud
npx tsx scripts/create-test-task.ts
```

## 🔍 验证任务拾取

### 1. 检查状态文件

```bash
cat memory/mc-poller-state.json
```

输出：
```json
{
  "lastPoll": 1708732800000,
  "lastPollByAgent": {
    "arthur": 1708732800000,
    "coder": 1708732800000,
    "researcher": 1708729000000
  },
  "totalTasksPicked": 1,
  "lastTaskId": "task-123"
}
```

### 2. 检查执行日志

```bash
cat memory/mc-task-execution-log.md
```

### 3. 检查 Convex Dashboard

1. 访问 Convex Dashboard
2. 查看 `tasks` 表
3. 确认任务状态变为 `in_progress`
4. 查看 `taskActivityLogs` 表，确认有 `picked_by_heartbeat` 记录

## 🔄 集成到心跳流程

### 编辑 HEARTBEAT.md

在心跳任务列表中添加：

```markdown
## 📋 Mission Control 任务轮询 (每次心跳必做 - P0)

1. 执行 `cd ~/openclaw/workspace/mission-control-next && npx tsx scripts/poll-mc-tasks.ts`
2. 检查输出是否有任务被拾取
3. 如有任务，验证 sub-agent 启动成功
```

### 自动触发（推荐）

心跳脚本会自动执行：
```bash
#!/bin/bash
# 心跳脚本片段

# Mission Control 任务轮询
cd ~/openclaw/workspace/mission-control-next
npx tsx scripts/poll-mc-tasks.ts >> memory/mc-poller.log 2>&1
```

## 🛠️ 故障排查

### 问题 1: Convex 连接失败

**症状**:
```
❌ Error polling for arthur: Failed to connect to Convex
```

**解决方案**:
1. 检查 `CONVEX_URL` 环境变量
2. 确认 Convex 已部署：`npx convex deploy --yes`
3. 检查网络连接

### 问题 2: 任务未被拾取

**症状**: 任务状态保持 `todo`，未被标记为 `in_progress`

**排查步骤**:
1. 检查任务标签是否匹配目标 Agent
2. 检查是否有其他 Agent 已拾取任务
3. 查看 Convex 活动日志

### 问题 3: Sub-agent 未启动

**症状**: 任务被拾取但 sub-agent 未执行

**解决方案**:
1. 检查 `sessions_spawn` 接口是否可用
2. 查看 `memory/mc-task-execution-log.md` 错误信息
3. 确认 sub-agent 配置正确

## 📊 监控指标

### 关键指标

| 指标 | 说明 | 正常值 |
|------|------|--------|
| `lastPoll` | 最后轮询时间 | < 30 分钟前 |
| `totalTasksPicked` | 累计拾取任务数 | 持续增长 |
| `lastPollByAgent.*` | 各 Agent 最后轮询时间 | < 30 分钟前 |

### 告警条件

- ⚠️ `lastPoll` > 1 小时 → 心跳可能停止
- ⚠️ 连续 3 次轮询无任务 → 可能路由配置错误
- ❌ 任务拾取后长时间无进展 → 可能 sub-agent 卡住

## 🔐 安全注意事项

1. **Convex URL**: 不要硬编码在代码中，使用环境变量
2. **认证**: 确保 Convex auth 配置正确
3. **日志**: 敏感信息不要写入日志文件

## 📚 相关文档

- [HEARTBEAT.md](../../HEARTBEAT.md) - 心跳集成文档
- [heartbeat-poller-report.md](../../memory/mc-implementation/heartbeat-poller-report.md) - 实现报告
- [convex/tasks.ts](../convex/tasks.ts) - Convex mutation 实现

---

**最后更新**: 2026-02-24  
**维护者**: Arthur Team
