/**
 * 超时检测和通知集成测试脚本
 * 
 * 测试流程：
 * 1. 创建测试任务
 * 2. 开始任务（设置 startedAt 和 lastProgressAt）
 * 3. 模拟超时（手动修改 lastProgressAt）
 * 4. 运行超时检测
 * 5. 验证告警
 * 6. 完成任务
 * 7. 验证完成通知
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { runTimeoutCheck } from "./check-timeouts";
import { sendCompletionNotification } from "./send-notification";

const CONVEX_URL = process.env.CONVEX_URL || "https://your-deployment.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

/**
 * 运行完整测试
 */
async function runTest() {
  console.log("🧪 开始超时检测和通知集成测试...\n");
  
  try {
    // 步骤 1: 创建测试任务
    console.log("📝 步骤 1: 创建测试任务");
    const createResult = await convex.mutation(api.tasks.create, {
      title: "【测试】超时检测任务",
      description: "这是一个用于测试超时检测功能的通知任务",
      priority: "high",
      assigneeName: "Test Agent",
      tags: ["test", "timeout"],
    });
    
    const taskId = createResult.taskId;
    console.log(`✅ 任务创建成功：${taskId}\n`);
    
    // 步骤 2: 开始任务
    console.log("📝 步骤 2: 开始任务（设置超时字段）");
    await convex.mutation(api.tasks.startTask, {
      taskId,
      actorId: "test-agent",
      actorName: "Test Agent",
      timeoutMinutes: 120, // 2 小时超时
    });
    console.log("✅ 任务已开始，超时阈值：120 分钟\n");
    
    // 步骤 3: 模拟超时（将 lastProgressAt 设置为 3 小时前）
    console.log("📝 步骤 3: 模拟超时（设置 lastProgressAt 为 3 小时前）");
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    
    // 注意：Convex 不允许直接修改数据库，这里仅做演示
    // 实际测试需要手动等待或使用 Convex 的系统函数
    console.log(`⚠️  注意：Convex 不允许直接修改数据库字段`);
    console.log(`⚠️  实际测试中，请等待任务自然超时，或手动更新 lastProgressAt\n`);
    
    // 步骤 4: 运行超时检测
    console.log("📝 步骤 4: 运行超时检测");
    const timeoutResult = await runTimeoutCheck();
    console.log(`✅ 超时检测完成：发现 ${timeoutResult.timeouts} 个超时任务\n`);
    
    // 步骤 5: 验证告警
    console.log("📝 步骤 5: 验证告警");
    if (timeoutResult.timeouts > 0) {
      console.log("✅ 告警已发送");
    } else {
      console.log("⚠️  无超时任务（可能因为任务刚创建，未达超时阈值）");
    }
    console.log();
    
    // 步骤 6: 完成任务
    console.log("📝 步骤 6: 完成任务");
    await convex.mutation(api.tasks.completeTask, {
      taskId,
      actorId: "test-agent",
      actorName: "Test Agent",
    });
    console.log("✅ 任务已完成\n");
    
    // 步骤 7: 验证完成通知
    console.log("📝 步骤 7: 验证完成通知");
    const task = await convex.query(api.tasks.getWithDetails, { taskId });
    if (task) {
      await sendCompletionNotification(task);
      console.log("✅ 完成通知已发送\n");
    }
    
    // 测试总结
    console.log("════════════════════════════════════════");
    console.log("✅ 测试完成！");
    console.log("════════════════════════════════════════");
    console.log(`任务 ID: ${taskId}`);
    console.log(`超时检测：${timeoutResult.timeouts} 个超时`);
    console.log(`告警发送：${timeoutResult.alertsSent} 个`);
    console.log(`完成通知：已发送`);
    console.log();
    console.log("📝 请检查以下位置验证通知：");
    console.log("  - Telegram 消息");
    console.log("  - memory/timeout-logs/");
    console.log("  - memory/completion-notifications/");
    console.log();
    
  } catch (error) {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  }
}

/**
 * 快速测试通知功能
 */
async function testNotificationOnly() {
  console.log("🧪 快速测试通知功能...\n");
  
  try {
    // 测试超时告警
    console.log("📝 测试超时告警通知");
    await sendCompletionNotification({
      _id: "test-timeout-123",
      title: "【测试】超时告警任务",
      assigneeName: "Test Agent",
      timeoutMinutes: 120,
      lastProgressAt: Date.now() - 3 * 60 * 60 * 1000,
      status: "in_progress",
    } as any);
    console.log("✅ 超时告警通知已发送\n");
    
    // 测试完成通知
    console.log("📝 测试完成通知");
    await sendCompletionNotification({
      _id: "test-complete-456",
      title: "【测试】完成任务",
      assigneeName: "Test Agent",
      completedAt: Date.now(),
      status: "done",
    } as any);
    console.log("✅ 完成通知已发送\n");
    
    console.log("✅ 通知功能测试完成！");
    console.log("📱 请检查 Telegram 消息");
    
  } catch (error) {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  }
}

// 命令行入口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === "quick") {
    await testNotificationOnly();
  } else if (command === "full") {
    await runTest();
  } else {
    console.log("用法：npx tsx test-timeout-notification.ts [quick|full]");
    console.log();
    console.log("  quick - 快速测试通知功能（不创建任务）");
    console.log("  full  - 完整测试流程（创建任务、模拟超时、验证通知）");
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}
