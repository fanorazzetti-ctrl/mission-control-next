#!/usr/bin/env tsx
/**
 * Arthur 心跳脚本 - 向 Mission Control 报告状态
 * 
 * 用法：
 *   npx tsx scripts/agent-heartbeat.ts
 *   npx tsx scripts/agent-heartbeat.ts --status working --task "Processing GitHub issue"
 * 
 * 集成到 HEARTBEAT.md：
 *   每次心跳时执行此脚本
 */

import { AgentSync } from "../src/lib/agent-sync.js";

// 解析命令行参数
const args = process.argv.slice(2);
const statusArg = args.find((arg, i) => arg === '--status' && args[i + 1]);
const taskArg = args.find((arg, i) => arg === '--task' && args[i + 1]);
const registerArg = args.includes('--register');

const status = statusArg ? args[args.indexOf('--status') + 1] : undefined;
const currentTask = taskArg ? args[args.indexOf('--task') + 1] : undefined;

async function main() {
  console.log('🫀 Arthur Heartbeat - Mission Control Status Sync');
  console.log('='.repeat(50));
  
  const sync = new AgentSync('Arthur');
  
  try {
    // 如果是 --register 模式，先注册 Agent
    if (registerArg) {
      console.log('\n📝 Registering Arthur to Mission Control...');
      const registered = await sync.register([
        'task-execution',
        'memory-management',
        'multi-agent-coordination',
        'web-research',
        'file-operations'
      ]);
      
      if (registered) {
        console.log('✅ Arthur registered successfully');
      } else {
        console.log('⚠️  Registration failed (running in mock mode?)');
      }
    }
    
    // 报告状态
    if (status) {
      console.log(`\n📊 Reporting status: ${status}`);
      if (currentTask) {
        console.log(`   Task: ${currentTask}`);
      }
      
      const success = await sync.reportStatus(status as any, currentTask);
      
      if (success) {
        console.log('✅ Status reported successfully');
      } else {
        console.log('❌ Failed to report status (max retries reached)');
      }
    } else {
      // 自动检测状态模式
      console.log('\n🔍 Auto-detecting status...');
      
      // 启动心跳（单次执行，不持续）
      // 实际使用时应该调用 startHeartbeat()，但脚本模式只执行一次
      const hasActiveTask = await checkActiveTask();
      const detectedStatus = hasActiveTask ? 'working' : 'idle';
      const taskName = hasActiveTask ? await getCurrentTaskName() : undefined;
      
      console.log(`   Detected status: ${detectedStatus}`);
      if (taskName) {
        console.log(`   Current task: ${taskName}`);
      }
      
      const success = await sync.reportStatus(detectedStatus, taskName);
      
      if (success) {
        console.log('✅ Status reported successfully');
      } else {
        console.log('❌ Failed to report status');
      }
    }
    
  } catch (error) {
    console.error('❌ Heartbeat failed:', error);
    process.exit(1);
  } finally {
    sync.close();
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Heartbeat completed');
}

/**
 * 检查是否有活跃任务
 * TODO: 实现实际的任务检查逻辑
 */
async function checkActiveTask(): Promise<boolean> {
  // 可以检查：
  // 1. memory/pending-github-task.json 是否存在
  // 2. 是否有运行中的 subagent
  // 3. 是否有执行中的脚本
  
  // 临时实现：检查 pending task 文件
  const fs = await import('fs');
  const path = await import('path');
  
  const pendingTaskPath = path.join(
    process.env.HOME || '',
    'openclaw/workspace/memory/pending-github-task.json'
  );
  
  try {
    await fs.promises.access(pendingTaskPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取当前任务名称
 * TODO: 实现实际的任务名称获取逻辑
 */
async function getCurrentTaskName(): Promise<string | undefined> {
  const fs = await import('fs');
  const path = await import('path');
  
  const pendingTaskPath = path.join(
    process.env.HOME || '',
    'openclaw/workspace/memory/pending-github-task.json'
  );
  
  try {
    const content = await fs.promises.readFile(pendingTaskPath, 'utf-8');
    const task = JSON.parse(content);
    return task.title || task.description || 'GitHub Task';
  } catch {
    return undefined;
  }
}

// 运行主函数
main().catch(console.error);
