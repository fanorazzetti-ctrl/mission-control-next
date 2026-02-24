# Agent 状态同步集成指南

## 概述

Arthur Agent 通过心跳机制主动向 Mission Control 报告自己的状态，实现数字办公室的可视化。

## 架构

```
┌─────────────────┐      心跳报告       ┌──────────────────┐
│  Arthur Agent   │ ──────────────────▶ │ Mission Control  │
│                 │                     │  (Convex + UI)   │
│  - 状态检测     │                     │                  │
│  - 状态上报     │                     │  - Office 页面   │
│  - 心跳循环     │                     │  - Agent 列表    │
└─────────────────┘                     └──────────────────┘
```

## 状态定义

| 状态 | 说明 | 触发条件 |
|------|------|----------|
| `idle` | 空闲 | 无活跃任务，等待中 |
| `working` | 工作中 | 有任务正在执行 |
| `offline` | 离线 | Agent 停止服务 |

## 文件结构

```
mission-control-next/
├── src/lib/
│   └── agent-sync.ts      # 状态同步工具类
├── convex/
│   └── agents.ts          # Convex API 实现
├── scripts/
│   ├── agent-heartbeat.ts # 心跳脚本
│   └── test-agent-sync.sh # 测试脚本
└── AGENT-SYNC-INTEGRATION.md # 本文档
```

## 使用方式

### 方式一：心跳脚本（推荐）

```bash
# 自动检测状态并报告
cd ~/openclaw/workspace/mission-control-next
npx tsx scripts/agent-heartbeat.ts

# 手动指定状态
npx tsx scripts/agent-heartbeat.ts --status working --task "Processing issue #42"

# 首次运行注册 Agent
npx tsx scripts/agent-heartbeat.ts --register
```

### 方式二：编程调用

```typescript
import { AgentSync } from "@/lib/agent-sync";

const sync = new AgentSync('Arthur');

// 报告状态
await sync.reportStatus('working', 'Processing GitHub issue');

// 启动心跳（每 30 分钟自动报告）
sync.startHeartbeat(30 * 60 * 1000);

// 停止心跳
sync.stopHeartbeat();

// 注册 Agent（首次启动）
await sync.register([
  'task-execution',
  'memory-management',
  'multi-agent-coordination'
]);
```

### 方式三：集成到 HEARTBEAT.md

在 `~/openclaw/workspace/HEARTBEAT.md` 中添加：

```markdown
## 🫀 Arthur 状态同步 (每次心跳必做)

执行：
```bash
cd ~/openclaw/workspace/mission-control-next && npx tsx scripts/agent-heartbeat.ts
```
```

## 部署 Convex（生产环境）

当前运行在 **Mock 模式**（Convex 未部署）。要启用实时数据同步：

### 步骤 1：登录 Convex

```bash
cd ~/openclaw/workspace/mission-control-next
npx convex login
```

这会打开浏览器进行认证。

### 步骤 2：部署项目

```bash
npx convex dev
```

这会：
- 部署 Convex functions
- 生成类型定义（`convex/_generated/`）
- 保持监听模式（开发环境）

### 步骤 3：验证部署

访问 Office 页面查看 Agent 状态：
```
http://localhost:3000/office
```

### 步骤 4：生产部署

```bash
npx convex deploy
```

## API 参考

### AgentSync 类

#### 构造函数

```typescript
constructor(agentName: string = 'Arthur')
```

#### reportStatus

```typescript
async reportStatus(
  status: 'idle' | 'working' | 'offline',
  currentTask?: string
): Promise<boolean>
```

参数：
- `status`: 状态值
- `currentTask`: 当前任务描述（可选）

返回：成功返回 `true`

#### startHeartbeat

```typescript
startHeartbeat(intervalMs: number = 30 * 60 * 1000): void
```

参数：
- `intervalMs`: 心跳间隔（毫秒），默认 30 分钟

#### stopHeartbeat

```typescript
stopHeartbeat(): void
```

#### register

```typescript
async register(capabilities: string[] = []): Promise<boolean>
```

参数：
- `capabilities`: 能力列表

### Convex API

#### agents.register

注册新 Agent：

```typescript
await client.mutation(api.agents.register, {
  agentName: "Arthur",
  role: "assistant",
  capabilities: ["task-execution", "memory-management"],
  status: "idle"
});
```

#### agents.updateStatus

更新状态：

```typescript
await client.mutation(api.agents.updateStatus, {
  agentName: "Arthur",
  status: "working",
  currentTask: "Processing issue #42",
  lastActiveAt: Date.now()
});
```

#### agents.list

获取所有 Agent：

```typescript
const agents = await client.query(api.agents.list, {});
```

#### agents.getStats

获取统计信息：

```typescript
const stats = await client.query(api.agents.getStats, {});
// 返回：{ total: 1, idle: 1, working: 0, offline: 0 }
```

## 错误处理

### 重试机制

- 自动重试最多 3 次
- 重试间隔：2 秒
- 失败后返回 `false`

### Mock 模式

当 `NEXT_PUBLIC_CONVEX_URL` 未配置时，自动降级为 Mock 模式：
- 仅输出日志
- 不实际调用 Convex
- 返回成功状态

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `CONVEX_URL not configured` | 未部署 Convex | 运行 `npx convex dev` |
| `Module not found` | 类型未生成 | 运行 `npx convex dev` |
| `Network error` | 网络问题 | 检查网络连接 |

## 测试

运行测试脚本：

```bash
./scripts/test-agent-sync.sh
```

测试内容：
1. 注册 Agent
2. 报告 idle 状态
3. 报告 working 状态
4. 自动检测状态

## 集成到 OpenClaw 心跳

状态同步已集成到 OpenClaw 心跳机制：

1. 每次心跳自动执行 `agent-heartbeat.ts`
2. 检测当前任务状态
3. 更新 Mission Control 数据库
4. Office 页面实时显示

## 未来扩展

### 多 Agent 支持

```typescript
const arthurSync = new AgentSync('Arthur');
const coderSync = new AgentSync('Coder');
const researcherSync = new AgentSync('Researcher');
```

### 任务详情上报

```typescript
await sync.reportStatus('working', {
  taskId: 'github-issue-42',
  title: 'Fix authentication bug',
  progress: 0.6,
  estimatedCompletion: Date.now() + 30 * 60 * 1000
});
```

### 能力动态更新

```typescript
await sync.updateCapabilities([
  'task-execution',
  'memory-management',
  'new-capability'
]);
```

## 故障排查

### 状态未更新

1. 检查 Convex 是否部署：`npx convex dev`
2. 检查 `.env.local` 配置
3. 查看控制台日志

### 心跳未执行

1. 检查 HEARTBEAT.md 配置
2. 确认 OpenClaw 心跳正常
3. 查看 `memory/heartbeat-state.json` 时间戳

### Office 页面显示离线

1. 确认最近心跳时间
2. 检查状态报告日志
3. 刷新页面（Convex 实时同步）

## 参考资料

- [Mission Control SDD](./SDD.md)
- [Convex 文档](https://docs.convex.dev/)
- [HEARTBEAT.md](../HEARTBEAT.md)
