# Mission Control 心跳协议

## 心跳频率
- **主要心跳**: 每 30 分钟一次
- **超时检测**: 每次心跳执行
- **完成通知检查**: 每次心跳执行

## 心跳检查清单

### 1. 超时检测（P0）
每次心跳必须执行：

```bash
cd ~/openclaw/workspace/mission-control-next
npx tsx scripts/check-timeouts.ts
```

**检测逻辑**:
- 查询所有 `status === "in_progress"` 的任务
- 检查 `lastProgressAt` 字段
- 如果 `(now - lastProgressAt) > timeoutMinutes * 60000`，视为超时
- 默认超时阈值：120 分钟（2 小时）

**告警动作**:
- 发送 Telegram 通知
- 发送 WhatsApp 通知（如配置）
- 记录超时日志到 `memory/timeout-logs/`
- 记录统计到 `memory/timeout-stats/`

### 2. 完成通知检查（P0）
每次心跳检查最近完成的任务：

```bash
# 查询最近 1 小时内完成的任务
# 检查是否已发送通知
# 如未发送，补发通知
```

**检查逻辑**:
- 查询所有 `status === "done"` 且 `completedAt` 在最近 1 小时内的任务
- 检查是否已发送完成通知（通过 `memory/completion-notifications/` 日志）
- 如未发送，调用 `send-notification.ts` 补发

**通知动作**:
- 发送 Telegram 通知
- 发送 WhatsApp 通知（如配置）
- 记录通知日志

### 3. Agent 状态同步（P1）
- 检查所有 Agent 的 `lastActiveAt`
- 超过 1 小时无活动标记为 `offline`
- 更新 `teamMembers` 表状态

### 4. 定时任务检查（P1）
- 查询 `scheduledEvents` 表
- 检查 `nextRun <= now` 的任务
- 执行对应的 handler
- 更新 `lastRun` 和 `nextRun`

### 5. 内容流水线检查（P2）
- 检查 `contentPipeline` 中停滞的内容
- 超过 24 小时无进展的内容发送提醒

## 心跳状态记录

心跳状态记录在 `memory/heartbeat-state.json`:

```json
{
  "lastHeartbeat": 1708742400000,
  "lastTimeoutCheck": 1708742400000,
  "lastCompletionCheck": 1708742400000,
  "lastAgentSync": 1708742400000,
  "heartbeatCount": 1234,
  "totalTimeoutsDetected": 5,
  "totalCompletionsNotified": 28
}
```

## 心跳脚本

创建 `scripts/heartbeat.ts`:

```typescript
import { runTimeoutCheck } from './check-timeouts';
import { checkCompletionNotifications } from './check-completions';
import { syncAgentStatus } from './sync-agents';
import { runScheduledTasks } from './run-scheduled-tasks';

export async function runHeartbeat() {
  console.log('💓 开始心跳...');
  
  const results = {
    timestamp: Date.now(),
    timeoutCheck: await runTimeoutCheck(),
    completionCheck: await checkCompletionNotifications(),
    agentSync: await syncAgentStatus(),
    scheduledTasks: await runScheduledTasks(),
  };
  
  // 更新心跳状态
  await updateHeartbeatState(results);
  
  console.log('✅ 心跳完成');
  return results;
}
```

## 集成到 OpenClaw 心跳

在 OpenClaw 的主心跳机制中调用 Mission Control 心跳：

```bash
# 每 30 分钟执行一次
npx tsx scripts/heartbeat.ts
```

## 通知配置

### Telegram
- 使用 OpenClaw `message send` 命令
- 目标：`telegram`
- 格式：Markdown

### WhatsApp
- 使用 WhatsApp Business API（待配置）
- 或使用第三方服务如 Twilio
- 格式：纯文本

## 日志位置

| 类型 | 路径 |
|------|------|
| 超时日志 | `memory/timeout-logs/YYYY-MM-DD.jsonl` |
| 超时统计 | `memory/timeout-stats/YYYY-MM-DD.json` |
| 完成通知 | `memory/completion-notifications/YYYY-MM-DD.jsonl` |
| 心跳状态 | `memory/heartbeat-state.json` |
| 心跳历史 | `memory/heartbeat-history/` |

## 故障处理

### 超时检测失败
- 记录错误到 `memory/error-log.json`
- 下次心跳重试
- 连续 3 次失败发送告警

### 通知发送失败
- 记录失败原因
- 不阻塞其他通知
- 累积失败超过 5 次发送系统告警

## 监控指标

- 心跳执行成功率
- 超时检测平均耗时
- 通知发送成功率
- 平均超时响应时间

## 版本历史

- **v1.0.0** (2026-02-24): 初始版本，包含超时检测和完成通知
