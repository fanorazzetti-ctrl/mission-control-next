/**
 * 超时检测脚本
 * 
 * 检查所有进行中的任务，识别超时任务并发送告警
 * 可被心跳定期调用
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { sendTimeoutAlert } from "./send-notification";

const CONVEX_URL = process.env.CONVEX_URL || "https://your-deployment.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

/**
 * 超时任务信息
 */
export interface TimeoutTask {
  _id: string;
  title: string;
  assigneeName?: string;
  timeoutMinutes: number;
  lastProgressAt: number;
  overdueMinutes: number;
}

/**
 * 检查超时任务
 */
export async function checkTimeouts(): Promise<TimeoutTask[]> {
  try {
    // 调用 Convex API 获取超时任务
    const timeouts = await convex.query(api.tasks.checkTimeouts);
    
    if (timeouts.length === 0) {
      console.log("✅ 无超时任务");
      return [];
    }
    
    console.log(`⚠️ 发现 ${timeouts.length} 个超时任务`);
    
    const timeoutTasks: TimeoutTask[] = [];
    const now = Date.now();
    
    for (const task of timeouts) {
      const overdueMinutes = Math.round((now - task.lastProgressAt) / 60000);
      
      timeoutTasks.push({
        _id: task._id,
        title: task.title,
        assigneeName: task.assigneeName,
        timeoutMinutes: task.timeoutMinutes || 120,
        lastProgressAt: task.lastProgressAt,
        overdueMinutes,
      });
      
      console.log(`  - ${task.title} (超时 ${overdueMinutes} 分钟，负责人：${task.assigneeName || "未分配"})`);
    }
    
    return timeoutTasks;
  } catch (error) {
    console.error("❌ 检查超时任务失败:", error);
    throw error;
  }
}

/**
 * 发送超时告警
 */
export async function sendTimeoutAlerts(timeoutTasks: TimeoutTask[]): Promise<void> {
  for (const task of timeoutTasks) {
    try {
      await sendTimeoutAlert({
        _id: task._id,
        title: task.title,
        assigneeName: task.assigneeName,
        timeoutMinutes: task.timeoutMinutes,
        lastProgressAt: task.lastProgressAt,
        status: "in_progress",
      });
    } catch (error) {
      console.error(`❌ 发送任务 ${task._id} 告警失败:`, error);
      // 继续处理其他任务
    }
  }
}

/**
 * 记录超时统计
 */
export async function logTimeoutStats(timeoutTasks: TimeoutTask[]): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  
  const statsDir = path.join(process.cwd(), "memory", "timeout-stats");
  const statsFile = path.join(statsDir, `${new Date().toISOString().split("T")[0]}.json`);
  
  // 确保目录存在
  if (!fs.existsSync(statsDir)) {
    fs.mkdirSync(statsDir, { recursive: true });
  }
  
  const stats = {
    timestamp: new Date().toISOString(),
    totalTimeouts: timeoutTasks.length,
    tasks: timeoutTasks.map(t => ({
      id: t._id,
      title: t.title,
      overdueMinutes: t.overdueMinutes,
      assigneeName: t.assigneeName,
    })),
  };
  
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  console.log(`📊 超时统计已记录：${statsFile}`);
}

/**
 * 主函数 - 执行完整的超时检测流程
 */
export async function runTimeoutCheck(): Promise<{
  checked: number;
  timeouts: number;
  alertsSent: number;
}> {
  console.log("🔍 开始超时检测...");
  console.log(`时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  
  try {
    // 1. 检查超时任务
    const timeoutTasks = await checkTimeouts();
    
    if (timeoutTasks.length === 0) {
      return { checked: 0, timeouts: 0, alertsSent: 0 };
    }
    
    // 2. 发送告警
    await sendTimeoutAlerts(timeoutTasks);
    
    // 3. 记录统计
    await logTimeoutStats(timeoutTasks);
    
    console.log(`✅ 超时检测完成：发现 ${timeoutTasks.length} 个超时任务，已发送告警`);
    
    return {
      checked: timeoutTasks.length,
      timeouts: timeoutTasks.length,
      alertsSent: timeoutTasks.length,
    };
  } catch (error) {
    console.error("❌ 超时检测失败:", error);
    throw error;
  }
}

/**
 * 命令行入口
 */
async function main() {
  try {
    await runTimeoutCheck();
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
