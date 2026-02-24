#!/usr/bin/env tsx
/**
 * Mission Control 任务轮询脚本
 * 
 * 功能：
 * 1. 调用 Convex pollForExecution mutation 获取待执行任务
 * 2. 根据 agentType 启动对应 sub-agent
 * 3. 执行完成后更新 Convex 状态
 * 
 * 使用方式：
 * npx tsx scripts/poll-mc-tasks.ts
 */

import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

// Convex 配置
const CONVEX_URL = process.env.CONVEX_URL || "https://your-deployment.convex.cloud";

// Agent 类型映射
const AGENT_TYPES = ["arthur", "coder", "researcher"] as const;
type AgentType = typeof AGENT_TYPES[number];

// 状态文件路径
const STATE_FILE = path.join(__dirname, "../../memory/mc-poller-state.json");

interface PollerState {
  lastPoll: number;
  lastPollByAgent: Record<AgentType, number>;
  totalTasksPicked: number;
  lastTaskId?: string;
}

/**
 * 读取状态文件
 */
function readState(): PollerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Failed to read state file:", error);
  }
  
  return {
    lastPoll: 0,
    lastPollByAgent: {
      arthur: 0,
      coder: 0,
      researcher: 0,
    },
    totalTasksPicked: 0,
  };
}

/**
 * 写入状态文件
 */
function writeState(state: PollerState) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("Failed to write state file:", error);
  }
}

/**
 * 启动 sub-agent 执行任务
 * 
 * 注意：实际执行需要通过 OpenClaw 的 sessions_spawn 或类似机制
 * 这里使用伪代码示意，实际集成需要根据 Arthur 的 sub-agent 系统调整
 */
async function spawnAgentForTask(
  agentType: AgentType,
  task: any
): Promise<{ success: boolean; sessionId?: string }> {
  console.log(`🤖 Spawning ${agentType} agent for task: ${task.title}`);
  
  // TODO: 实际集成时需要调用 Arthur 的 sub-agent 系统
  // 示例代码（需要根据实际 API 调整）：
  /*
  const session = await sessions_spawn({
    task: `Execute Mission Control task: ${task.title}\n\nDescription: ${task.description || "No description"}\n\nTask ID: ${task._id}`,
    label: `mc-task-${task._id}`,
    agentType: agentType,
  });
  */
  
  // Mock 实现：记录到日志
  const logFile = path.join(__dirname, "../../memory/mc-task-execution-log.md");
  const logEntry = `## Task Executed - ${new Date().toISOString()}\n\n` +
    `- **Task ID**: ${task._id}\n` +
    `- **Title**: ${task.title}\n` +
    `- **Agent Type**: ${agentType}\n` +
    `- **Status**: Spawned (mock)\n\n`;
  
  fs.appendFileSync(logFile, logEntry);
  
  return { success: true, sessionId: `mock-session-${Date.now()}` };
}

/**
 * 更新 Convex 任务状态（执行完成）
 */
async function markTaskComplete(
  convex: ConvexClient,
  taskId: string,
  actorId: string
) {
  try {
    await convex.mutation(api.tasks.completeTask, {
      taskId: taskId as any,
      actorId,
      actorName: "Heartbeat Poller",
    });
    console.log(`✅ Task ${taskId} marked as complete`);
  } catch (error) {
    console.error(`❌ Failed to complete task ${taskId}:`, error);
  }
}

/**
 * 更新任务进度
 */
async function updateTaskProgress(
  convex: ConvexClient,
  taskId: string,
  progress: number,
  actorId: string
) {
  try {
    await convex.mutation(api.tasks.updateProgress, {
      taskId: taskId as any,
      progress,
      actorId,
      actorName: "Heartbeat Poller",
    });
    console.log(`📊 Task ${taskId} progress updated to ${progress}%`);
  } catch (error) {
    console.error(`❌ Failed to update task ${taskId} progress:`, error);
  }
}

/**
 * 主轮询函数
 */
async function pollTasks() {
  console.log("🫀 Mission Control Task Poller - Starting...\n");
  
  const state = readState();
  const now = Date.now();
  
  // 创建 Convex 客户端（Mock 模式检测）
  const isMock = !process.env.CONVEX_URL || process.env.CONVEX_URL.includes("your-deployment");
  
  if (isMock) {
    console.log("⚠️  Convex URL not configured - Running in MOCK mode\n");
    console.log("To enable real Convex integration:");
    console.log("1. Set CONVEX_URL environment variable");
    console.log("2. Ensure Convex is deployed: npx convex deploy\n");
  }
  
  let convex: ConvexClient | null = null;
  if (!isMock) {
    convex = new ConvexClient(CONVEX_URL);
  }
  
  // 遍历所有 Agent 类型进行轮询
  for (const agentType of AGENT_TYPES) {
    console.log(`🔍 Polling for ${agentType}...`);
    
    try {
      // 调用 Convex mutation
      let result;
      if (convex) {
        result = await convex.mutation(api.tasks.pollForExecution, {
          agentType,
        });
      } else {
        // Mock 模式
        console.log(`   [MOCK] Would poll for ${agentType}`);
        result = { success: false, reason: "mock_mode" };
      }
      
      if (result.success && result.task) {
        console.log(`✅ Found task for ${agentType}: ${result.task.title}`);
        console.log(`   ID: ${result.task._id}`);
        console.log(`   Routed by: ${result.routedBy}`);
        
        // 启动对应 agent
        const spawnResult = await spawnAgentForTask(agentType as AgentType, result.task);
        
        if (spawnResult.success) {
          console.log(`   🚀 Agent spawned: ${spawnResult.sessionId}`);
          
          // 更新状态
          state.lastPoll = now;
          state.lastPollByAgent[agentType as AgentType] = now;
          state.totalTasksPicked += 1;
          state.lastTaskId = result.task._id;
          writeState(state);
        } else {
          console.log(`   ❌ Failed to spawn agent`);
        }
      } else {
        console.log(`   No tasks available for ${agentType} (${result.reason || "unknown"})`);
      }
    } catch (error) {
      console.error(`   ❌ Error polling for ${agentType}:`, error);
    }
    
    console.log(); // 空行分隔
  }
  
  // 总结
  console.log("📊 Poll Summary:");
  console.log(`   Total tasks picked (session): ${state.totalTasksPicked}`);
  console.log(`   Last poll: ${new Date(state.lastPoll).toISOString()}`);
  console.log(`   Last poll by agent:`);
  for (const [agent, time] of Object.entries(state.lastPollByAgent)) {
    console.log(`     - ${agent}: ${time ? new Date(time).toISOString() : "never"}`);
  }
  
  console.log("\n✅ Mission Control Task Poller - Complete\n");
}

// 执行
pollTasks().catch(console.error);
