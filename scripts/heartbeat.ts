/**
 * 心跳脚本
 * 
 * 定期执行以下检查：
 * 1. 超时检测
 * 2. 完成通知检查
 * 3. Agent 状态同步
 * 4. 定时任务执行
 */

import { runTimeoutCheck } from './check-timeouts';
import { sendCompletionNotification } from './send-notification';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || "https://your-deployment.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

/**
 * 心跳状态
 */
interface HeartbeatState {
  lastHeartbeat: number;
  lastTimeoutCheck: number;
  lastCompletionCheck: number;
  lastAgentSync: number;
  heartbeatCount: number;
  totalTimeoutsDetected: number;
  totalCompletionsNotified: number;
}

/**
 * 心跳结果
 */
interface HeartbeatResult {
  timestamp: number;
  timeoutCheck: {
    checked: number;
    timeouts: number;
    alertsSent: number;
  };
  completionCheck: {
    checked: number;
    notificationsSent: number;
  };
  agentSync: {
    synced: number;
    offline: number;
  };
  scheduledTasks: {
    executed: number;
  };
}

/**
 * 读取心跳状态
 */
async function readHeartbeatState(): Promise<HeartbeatState> {
  const fs = await import("fs");
  const path = await import("path");
  
  const stateFile = path.join(process.cwd(), "memory", "heartbeat-state.json");
  
  try {
    if (fs.existsSync(stateFile)) {
      const content = fs.readFileSync(stateFile, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("读取心跳状态失败:", error);
  }
  
  // 返回默认状态
  return {
    lastHeartbeat: 0,
    lastTimeoutCheck: 0,
    lastCompletionCheck: 0,
    lastAgentSync: 0,
    heartbeatCount: 0,
    totalTimeoutsDetected: 0,
    totalCompletionsNotified: 0,
  };
}

/**
 * 写入心跳状态
 */
async function writeHeartbeatState(state: HeartbeatState): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  
  const stateDir = path.join(process.cwd(), "memory");
  const stateFile = path.join(stateDir, "heartbeat-state.json");
  
  // 确保目录存在
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * 检查完成通知
 */
async function checkCompletionNotifications(): Promise<{
  checked: number;
  notificationsSent: number;
}> {
  console.log("🔍 检查完成通知...");
  
  try {
    // 获取所有已完成的任务
    const doneTasks = await convex.query(api.tasks.getByStatus, { status: "done" });
    
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // 过滤最近 1 小时完成的任务
    const recentCompletions = doneTasks.filter(task => 
      task.completedAt && 
      task.completedAt > oneHourAgo
    );
    
    if (recentCompletions.length === 0) {
      console.log("✅ 无新完成的任务");
      return { checked: recentCompletions.length, notificationsSent: 0 };
    }
    
    // 检查是否已发送通知
    const notifiedTasks = await getNotifiedTasks();
    let notificationsSent = 0;
    
    for (const task of recentCompletions) {
      if (!notifiedTasks.includes(task._id)) {
        try {
          await sendCompletionNotification(task);
          await markTaskNotified(task._id);
          notificationsSent++;
          console.log(`✅ 已发送完成通知：${task.title}`);
        } catch (error) {
          console.error(`❌ 发送任务 ${task._id} 完成通知失败:`, error);
        }
      }
    }
    
    console.log(`✅ 完成通知检查完成：${notificationsSent} 个新通知`);
    
    return {
      checked: recentCompletions.length,
      notificationsSent,
    };
  } catch (error) {
    console.error("❌ 检查完成通知失败:", error);
    return { checked: 0, notificationsSent: 0 };
  }
}

/**
 * 获取已通知的任务列表
 */
async function getNotifiedTasks(): Promise<string[]> {
  const fs = await import("fs");
  const path = await import("path");
  
  const logDir = path.join(process.cwd(), "memory", "completion-notifications");
  const today = new Date().toISOString().split("T")[0];
  const logFile = path.join(logDir, `${today}.jsonl`);
  
  try {
    if (!fs.existsSync(logFile)) {
      return [];
    }
    
    const content = fs.readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n").filter(line => line.length > 0);
    
    const notifiedTasks = new Set<string>();
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.taskId) {
        notifiedTasks.add(entry.taskId);
      }
    }
    
    return Array.from(notifiedTasks);
  } catch (error) {
    console.error("读取通知日志失败:", error);
    return [];
  }
}

/**
 * 标记任务已通知
 */
async function markTaskNotified(taskId: string): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  
  const logDir = path.join(process.cwd(), "memory", "completion-notifications");
  const today = new Date().toISOString().split("T")[0];
  const logFile = path.join(logDir, `${today}.jsonl`);
  
  // 确保目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const entry = {
    timestamp: new Date().toISOString(),
    taskId,
    type: "completion",
  };
  
  fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
}

/**
 * 同步 Agent 状态
 */
async function syncAgentStatus(): Promise<{
  synced: number;
  offline: number;
}> {
  console.log("🔄 同步 Agent 状态...");
  
  try {
    // TODO: 实现 Agent 状态同步逻辑
    // 这里暂时返回空结果
    
    console.log("✅ Agent 状态同步完成");
    return { synced: 0, offline: 0 };
  } catch (error) {
    console.error("❌ Agent 状态同步失败:", error);
    return { synced: 0, offline: 0 };
  }
}

/**
 * 执行定时任务
 */
async function runScheduledTasks(): Promise<{
  executed: number;
}> {
  console.log("⏰ 检查定时任务...");
  
  try {
    // TODO: 实现定时任务执行逻辑
    // 这里暂时返回空结果
    
    console.log("✅ 定时任务检查完成");
    return { executed: 0 };
  } catch (error) {
    console.error("❌ 定时任务执行失败:", error);
    return { executed: 0 };
  }
}

/**
 * 记录心跳历史
 */
async function logHeartbeat(result: HeartbeatResult): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  
  const historyDir = path.join(process.cwd(), "memory", "heartbeat-history");
  const today = new Date().toISOString().split("T")[0];
  const historyFile = path.join(historyDir, `${today}.jsonl`);
  
  // 确保目录存在
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  
  fs.appendFileSync(historyFile, JSON.stringify(result) + "\n");
}

/**
 * 主心跳函数
 */
export async function runHeartbeat(): Promise<HeartbeatResult> {
  console.log("💓 开始心跳...");
  console.log(`时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  
  const startTime = Date.now();
  
  // 读取当前状态
  const state = await readHeartbeatState();
  
  // 执行各项检查
  const timeoutResult = await runTimeoutCheck();
  const completionResult = await checkCompletionNotifications();
  const agentResult = await syncAgentStatus();
  const scheduledResult = await runScheduledTasks();
  
  // 构建结果
  const result: HeartbeatResult = {
    timestamp: startTime,
    timeoutCheck: timeoutResult,
    completionCheck: completionResult,
    agentSync: agentResult,
    scheduledTasks: scheduledResult,
  };
  
  // 更新状态
  state.lastHeartbeat = startTime;
  state.lastTimeoutCheck = startTime;
  state.lastCompletionCheck = startTime;
  state.lastAgentSync = startTime;
  state.heartbeatCount++;
  state.totalTimeoutsDetected += timeoutResult.timeouts;
  state.totalCompletionsNotified += completionResult.notificationsSent;
  
  await writeHeartbeatState(state);
  
  // 记录历史
  await logHeartbeat(result);
  
  const duration = Date.now() - startTime;
  console.log(`✅ 心跳完成，耗时 ${duration}ms`);
  
  return result;
}

/**
 * 命令行入口
 */
async function main() {
  try {
    await runHeartbeat();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}
