/**
 * 通知发送脚本
 * 
 * 支持 WhatsApp/Telegram 通知通道
 * 用于发送任务完成通知和超时告警
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || "https://your-deployment.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

/**
 * 通知类型
 */
export type NotificationType = "task_complete" | "task_timeout" | "task_warning";

/**
 * 通知参数
 */
export interface NotificationParams {
  type: NotificationType;
  taskId: string;
  taskTitle: string;
  assigneeName?: string;
  details?: string;
  channel?: "telegram" | "whatsapp" | "both";
}

/**
 * 发送通知
 */
export async function sendNotification(params: NotificationParams): Promise<void> {
  const { type, taskId, taskTitle, assigneeName, details, channel = "both" } = params;
  
  let title: string;
  let message: string;
  let emoji: string;
  
  switch (type) {
    case "task_complete":
      emoji = "✅";
      title = "任务完成";
      message = `任务 "${taskTitle}" 已完成`;
      break;
      
    case "task_timeout":
      emoji = "⚠️";
      title = "任务超时告警";
      message = `任务 "${taskTitle}" 已超过 ${details || "2 小时"} 无进展`;
      break;
      
    case "task_warning":
      emoji = "🔔";
      title = "任务提醒";
      message = details || `任务 "${taskTitle}" 需要关注`;
      break;
      
    default:
      emoji = "📢";
      title = "任务通知";
      message = details || `任务 "${taskTitle}"`;
  }
  
  if (assigneeName) {
    message += `\n负责人：${assigneeName}`;
  }
  
  message += `\n任务 ID: ${taskId}`;
  message += `\n时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`;
  
  const fullMessage = `${emoji} *${title}*\n\n${message}`;
  
  // 根据通道发送通知
  if (channel === "telegram" || channel === "both") {
    await sendTelegramNotification(fullMessage);
  }
  
  if (channel === "whatsapp" || channel === "both") {
    await sendWhatsAppNotification(fullMessage);
  }
  
  console.log(`✅ 通知已发送：${title} - ${taskTitle}`);
}

/**
 * 发送 Telegram 通知
 */
async function sendTelegramNotification(message: string): Promise<void> {
  try {
    // 使用 OpenClaw message 工具发送
    // 这里需要通过 exec 调用 openclaw message send
    const { exec } = await import("child_process");
    const util = await import("util");
    const execAsync = util.promisify(exec);
    
    // 转义消息中的特殊字符
    const escapedMessage = message.replace(/"/g, '\\"');
    
    await execAsync(`openclaw message send --target telegram --message "${escapedMessage}"`);
    console.log("📱 Telegram 通知已发送");
  } catch (error) {
    console.error("❌ Telegram 通知发送失败:", error);
    // 不抛出错误，允许部分失败
  }
}

/**
 * 发送 WhatsApp 通知
 */
async function sendWhatsAppNotification(message: string): Promise<void> {
  try {
    // WhatsApp 通知实现（根据实际配置调整）
    // 目前先记录日志，后续可集成 WhatsApp Business API
    console.log("📱 WhatsApp 通知:", message);
    
    // TODO: 集成 WhatsApp Business API 或其他 WhatsApp 通知服务
    // const { exec } = await import("child_process");
    // const util = await import("util");
    // const execAsync = util.promisify(exec);
    // await execAsync(`your-whatsapp-cli send "${message}"`);
    
    console.log("⚠️ WhatsApp 通知暂未配置，已记录日志");
  } catch (error) {
    console.error("❌ WhatsApp 通知发送失败:", error);
    // 不抛出错误，允许部分失败
  }
}

/**
 * 发送超时告警
 */
export async function sendTimeoutAlert(task: any): Promise<void> {
  const timeoutHours = (task.timeoutMinutes || 120) / 60;
  
  await sendNotification({
    type: "task_timeout",
    taskId: task._id,
    taskTitle: task.title,
    assigneeName: task.assigneeName,
    details: `${timeoutHours}小时`,
    channel: "both",
  });
  
  // 记录超时日志
  await logTimeout(task);
}

/**
 * 发送完成通知
 */
export async function sendCompletionNotification(task: any): Promise<void> {
  await sendNotification({
    type: "task_complete",
    taskId: task._id,
    taskTitle: task.title,
    assigneeName: task.assigneeName,
    channel: "both",
  });
}

/**
 * 记录超时日志
 */
async function logTimeout(task: any): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    taskId: task._id,
    taskTitle: task.title,
    assigneeName: task.assigneeName,
    timeoutMinutes: task.timeoutMinutes || 120,
    lastProgressAt: task.lastProgressAt,
    status: task.status,
  };
  
  const fs = await import("fs");
  const path = await import("path");
  
  const logDir = path.join(process.cwd(), "memory", "timeout-logs");
  const logFile = path.join(logDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
  
  // 确保目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // 追加日志
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
  console.log(`📝 超时日志已记录：${logFile}`);
}

/**
 * 主函数 - 用于命令行调用
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === "test") {
    // 测试通知
    await sendNotification({
      type: "task_complete",
      taskId: "test-123",
      taskTitle: "测试任务",
      assigneeName: "Test Agent",
      channel: "telegram",
    });
  } else if (command === "timeout") {
    // 测试超时告警
    await sendNotification({
      type: "task_timeout",
      taskId: "test-456",
      taskTitle: "超时测试任务",
      assigneeName: "Test Agent",
      details: "2 小时",
      channel: "telegram",
    });
  } else {
    console.log("用法：npx tsx send-notification.ts [test|timeout]");
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}
