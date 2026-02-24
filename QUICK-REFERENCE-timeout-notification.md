# Mission Control 超时检测与通知 - 快速参考

## 🚀 快速开始

### 1. 创建任务并启用超时检测

```typescript
import { api } from "./convex/_generated/api";

// 创建任务
const { taskId } = await convex.mutation(api.tasks.create, {
  title: "重要任务",
  priority: "high",
  assigneeName: "Agent A",
});

// 开始任务（自动设置超时字段）
await convex.mutation(api.tasks.startTask, {
  taskId,
  actorId: "agent-a",
  actorName: "Agent A",
  timeoutMinutes: 120, // 2 小时超时，默认值
});
```

### 2. 更新任务进展（重置超时计时器）

```typescript
// 更新进度时自动更新 lastProgressAt
await convex.mutation(api.tasks.updateProgress, {
  taskId,
  progress: 50,
  actorId: "agent-a",
  actorName: "Agent A",
});
```

### 3. 完成任务（触发通知）

```typescript
await convex.mutation(api.tasks.completeTask, {
  taskId,
  actorId: "agent-a",
  actorName: "Agent A",
});
```

---

## 🔍 手动检查超时

```bash
cd ~/openclaw/workspace/mission-control-next

# 运行超时检测
npx tsx scripts/check-timeouts.ts

# 查看超时日志
cat memory/timeout-logs/$(date +%Y-%m-%d).jsonl
```

---

## 💓 心跳集成

### 添加到 crontab（每 30 分钟）

```bash
crontab -e

# 添加以下行
*/30 * * * * cd ~/openclaw/workspace/mission-control-next && npx tsx scripts/heartbeat.ts >> memory/heartbeat.log 2>&1
```

### 或通过 OpenClaw 心跳

在 OpenClaw 的心跳机制中调用：

```typescript
import { runHeartbeat } from './mission-control-next/scripts/heartbeat';

// 在心跳中调用
await runHeartbeat();
```

---

## 📱 通知测试

```bash
cd ~/openclaw/workspace/mission-control-next

# 快速测试通知功能
npx tsx scripts/test-timeout-notification.ts quick

# 完整测试流程
npx tsx scripts/test-timeout-notification.ts full
```

---

## 🔧 API 参考

### Query APIs

| API | 说明 | 参数 |
|-----|------|------|
| `checkTimeouts` | 检查超时任务 | 无 |

### Mutation APIs

| API | 说明 | 参数 |
|-----|------|------|
| `startTask` | 开始任务 | `taskId`, `actorId`, `actorName?`, `timeoutMinutes?` |
| `completeTask` | 完成任务 | `taskId`, `actorId`, `actorName?` |
| `updateProgress` | 更新进度 | `taskId`, `progress`, `actorId?`, `actorName?` |
| `updateStatus` | 更新状态 | `taskId`, `status`, `actorId?`, `actorName?` |

---

## 📊 日志文件

| 文件 | 说明 | 位置 |
|------|------|------|
| `heartbeat-state.json` | 心跳状态 | `memory/` |
| `timeout-logs/YYYY-MM-DD.jsonl` | 超时日志 | `memory/` |
| `timeout-stats/YYYY-MM-DD.json` | 超时统计 | `memory/` |
| `completion-notifications/YYYY-MM-DD.jsonl` | 完成通知日志 | `memory/` |
| `heartbeat-history/YYYY-MM-DD.jsonl` | 心跳历史 | `memory/` |

---

## ⚙️ 配置选项

### 自定义超时阈值

```typescript
// 创建任务时指定
await convex.mutation(api.tasks.startTask, {
  taskId,
  actorId: "agent-a",
  timeoutMinutes: 60, // 1 小时超时
});
```

### 通知通道

```typescript
// 在 send-notification.ts 中配置
await sendNotification({
  type: "task_complete",
  taskId,
  taskTitle: "任务",
  channel: "telegram", // 或 "whatsapp" 或 "both"
});
```

---

## 🐛 故障排查

### 问题：超时检测不工作

**检查**:
1. 任务状态是否为 `in_progress`
2. `lastProgressAt` 是否已设置
3. 超时阈值是否合理

```typescript
// 查看任务详情
const task = await convex.query(api.tasks.getWithDetails, { taskId });
console.log({
  status: task.status,
  lastProgressAt: task.lastProgressAt,
  timeoutMinutes: task.timeoutMinutes,
});
```

### 问题：通知未发送

**检查**:
1. OpenClaw Telegram 配置是否正确
2. 通知日志是否记录
3. 脚本是否有执行权限

```bash
# 检查通知日志
cat memory/completion-notifications/$(date +%Y-%m-%d).jsonl

# 测试 Telegram 通知
openclaw message send --target telegram --message "测试通知"
```

### 问题：心跳未执行

**检查**:
1. cron job 是否配置
2. 脚本是否有执行权限
3. Node.js 环境是否正常

```bash
# 检查 cron
crontab -l | grep heartbeat

# 手动执行心跳
npx tsx scripts/heartbeat.ts

# 查看心跳日志
tail -f memory/heartbeat.log
```

---

## 📈 监控指标

### 关键指标

- **超时检测率**: 超时任务数 / 进行中任务数
- **通知成功率**: 成功发送数 / 应发送数
- **平均响应时间**: 超时到告警的时间差
- **心跳执行率**: 实际执行数 / 计划执行数

### 查看统计

```bash
# 今日超时统计
cat memory/timeout-stats/$(date +%Y-%m-%d).json | jq

# 心跳历史
tail -20 memory/heartbeat-history/$(date +%Y-%m-%d).jsonl | jq
```

---

## 📚 相关文档

- [HEARTBEAT.md](./HEARTBEAT.md) - 心跳协议详细说明
- [timeout-notification-report.md](../../memory/mc-implementation/timeout-notification-report.md) - 实现报告

---

**最后更新**: 2026-02-24
