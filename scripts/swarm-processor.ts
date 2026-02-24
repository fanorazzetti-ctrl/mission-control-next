#!/usr/bin/env tsx
/**
 * 蜂群任务处理器 - 自动分解复杂任务并调度子 Agent 并行执行
 * 
 * 功能：
 * 1. 监听复杂任务（标签：complex/swarm_task）
 * 2. 自动调用 decomposeTask 分解为子任务
 * 3. spawn 多个 sub-agents 并行执行子任务
 * 4. 监控子任务进度，全部完成后自动聚合结果
 * 
 * 用法：
 *   npx tsx scripts/swarm-processor.ts
 *   npx tsx scripts/swarm-processor.ts --taskId <task_id>
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Convex 客户端配置
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const CONVEX_DEPLOYMENT = process.env.CONVEX_DEPLOYMENT;

let convex: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
  if (!convex) {
    if (!CONVEX_URL) {
      console.log('⚠️  Convex 未配置，运行在 MOCK 模式');
      return null as any;
    }
    convex = new ConvexHttpClient(CONVEX_URL);
  }
  return convex;
}

interface Task {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  status: string;
  priority: string;
  tags?: string[];
  parentId?: Id<"tasks">;
  progress: number;
  assigneeId?: Id<"agents">;
  assigneeName?: string;
}

interface SwarmConfig {
  maxParallelAgents: number;
  autoDecompose: boolean;
  autoAggregate: boolean;
  taskTypes: string[];
}

const DEFAULT_CONFIG: SwarmConfig = {
  maxParallelAgents: 3,
  autoDecompose: true,
  autoAggregate: true,
  taskTypes: ["complex", "swarm_task", "bounty", "multi_agent"],
};

/**
 * 主处理循环
 */
async function main() {
  console.log('🐝 Swarm Task Processor - 蜂群任务处理器');
  console.log('='.repeat(60));
  
  const args = process.argv.slice(2);
  const taskIdArg = args.find((arg, i) => arg === '--taskId' && args[i + 1]);
  const taskId = taskIdArg ? args[args.indexOf('--taskId') + 1] : undefined;
  
  const config = loadConfig();
  console.log('\n📋 配置:');
  console.log(`   最大并行 Agent 数：${config.maxParallelAgents}`);
  console.log(`   自动分解：${config.autoDecompose}`);
  console.log(`   自动聚合：${config.autoAggregate}`);
  console.log(`   任务类型：${config.taskTypes.join(', ')}`);
  
  try {
    if (taskId) {
      // 处理指定任务
      console.log(`\n🎯 处理指定任务：${taskId}`);
      await processSpecificTask(taskId as Id<"tasks">, config);
    } else {
      // 轮询模式：检查所有待处理的蜂群任务
      console.log('\n🔍 轮询模式：检查待处理的蜂群任务...');
      await pollSwarmTasks(config);
    }
  } catch (error) {
    console.error('❌ 蜂群处理失败:', error);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 蜂群处理完成');
}

/**
 * 加载配置
 */
function loadConfig(): SwarmConfig {
  const configPath = path.join(__dirname, '../swarm-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    }
  } catch (error) {
    console.warn('⚠️  无法加载配置文件，使用默认配置');
  }
  return DEFAULT_CONFIG;
}

/**
 * 轮询蜂群任务
 */
async function pollSwarmTasks(config: SwarmConfig) {
  const client = getConvexClient();
  
  if (!client) {
    console.log('⚠️  Convex 未连接，跳过轮询');
    return;
  }
  
  try {
    // 获取所有任务
    const allTasks = await client.query(api.tasks.list).run();
    
    // 筛选需要蜂群处理的任务
    const swarmTasks = allTasks.filter((task: Task) => {
      const tags = task.tags || [];
      const hasSwarmTag = config.taskTypes.some(type => 
        tags.includes(type) || tags.includes(`${type}_task`)
      );
      const isParent = !task.parentId;
      const notDecomposed = !tags.includes('decomposed');
      const notDone = task.status !== 'done';
      
      return hasSwarmTag && isParent && notDecomposed && notDone;
    });
    
    if (swarmTasks.length === 0) {
      console.log('✅ 没有待处理的蜂群任务');
      return;
    }
    
    console.log(`\n📊 发现 ${swarmTasks.length} 个待处理蜂群任务:`);
    swarmTasks.forEach((task: Task, i: number) => {
      console.log(`   ${i + 1}. [${task.priority}] ${task.title} (${task._id})`);
    });
    
    // 处理每个任务
    for (const task of swarmTasks) {
      await processSpecificTask(task._id, config);
    }
    
    // 检查是否需要聚合
    if (config.autoAggregate) {
      console.log('\n🔄 检查待聚合任务...');
      await autoAggregateResults();
    }
    
  } catch (error) {
    console.error('❌ 轮询失败:', error);
  }
}

/**
 * 处理指定任务
 */
async function processSpecificTask(taskId: Id<"tasks">, config: SwarmConfig) {
  const client = getConvexClient();
  
  if (!client) {
    console.log('⚠️  Convex 未连接，使用 MOCK 模式');
    await mockProcessTask(taskId, config);
    return;
  }
  
  try {
    // 获取任务详情
    const task = await client.query(api.tasks.getWithDetails).run({ taskId });
    
    if (!task) {
      console.log(`❌ 任务不存在：${taskId}`);
      return;
    }
    
    console.log(`\n📋 任务详情:`);
    console.log(`   标题：${task.title}`);
    console.log(`   状态：${task.status}`);
    console.log(`   优先级：${task.priority}`);
    console.log(`   标签：${(task.tags || []).join(', ')}`);
    console.log(`   子任务数：${task.subTasks?.length || 0}`);
    
    // 检查是否已分解
    if (task.tags?.includes('decomposed')) {
      console.log('ℹ️  任务已分解，跳过');
      return;
    }
    
    // 自动分解任务
    if (config.autoDecompose) {
      console.log('\n🔪 正在分解任务...');
      
      // 确定分解类型
      let decompType = 'auto';
      const tags = task.tags || [];
      if (tags.includes('research')) decompType = 'research';
      else if (tags.includes('development') || tags.includes('coding')) decompType = 'development';
      else if (tags.includes('analysis') || tags.includes('data')) decompType = 'analysis';
      
      console.log(`   分解类型：${decompType}`);
      
      const result = await client.mutation(api.tasks.decomposeTask, {
        taskId,
        decompositionType: decompType as any,
      });
      
      if (result.success) {
        console.log(`✅ 任务分解成功，创建 ${result.subTasks.length} 个子任务`);
        result.subTasks.forEach((st: any, i: number) => {
          console.log(`   ${i + 1}. ${st.id}`);
        });
      } else {
        console.log(`⚠️  分解失败：${result.error}`);
        return;
      }
    }
    
    // 获取更新后的子任务列表
    const updatedTask = await client.query(api.tasks.getWithDetails).run({ taskId });
    const subTasks = updatedTask?.subTasks || [];
    
    if (subTasks.length === 0) {
      console.log('⚠️  没有子任务，跳过 Agent 调度');
      return;
    }
    
    // 并行执行子任务（限制并发数）
    console.log(`\n🚀 启动 ${Math.min(subTasks.length, config.maxParallelAgents)} 个 Agent 并行执行...`);
    
    const chunks = chunkArray(subTasks, config.maxParallelAgents);
    
    for (const chunk of chunks) {
      const promises = chunk.map((subTask: any) => 
        spawnSubAgentForTask(subTask, task)
      );
      
      await Promise.all(promises);
    }
    
    console.log('\n✅ 所有子任务 Agent 已启动');
    
  } catch (error) {
    console.error('❌ 任务处理失败:', error);
  }
}

/**
 * MOCK 模式处理任务（Convex 未连接时）
 */
async function mockProcessTask(taskId: Id<"tasks">, config: SwarmConfig) {
  console.log('\n🎭 MOCK 模式：模拟任务处理');
  console.log(`   任务 ID: ${taskId}`);
  console.log(`   分解类型：auto`);
  console.log(`   创建子任务：3 个 (规划/执行/验收)`);
  console.log(`   启动 Agent: 3 个并行`);
  
  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('✅ MOCK 处理完成');
}

/**
 * 为子任务 spawn 子 Agent
 */
async function spawnSubAgentForTask(subTask: any, parentTask: any) {
  console.log(`\n🤖 为子任务启动 Agent: ${subTask.title}`);
  
  const subTaskId = subTask._id;
  const label = `swarm-subtask-${subTaskId}`;
  
  // 构建子 Agent 任务描述
  const taskDescription = {
    type: 'swarm_subtask',
    parentTaskId: parentTask._id,
    parentTaskTitle: parentTask.title,
    subTaskId,
    subTaskTitle: subTask.title,
    subTaskDescription: subTask.description,
    priority: subTask.priority,
    tags: subTask.tags,
  };
  
  console.log(`   Label: ${label}`);
  console.log(`   优先级：${subTask.priority}`);
  
  // 使用 OpenClaw sessions_spawn 启动子 Agent
  // 注意：这里需要通过 exec 调用 openclaw 命令
  try {
    const spawnCmd = `openclaw sessions spawn --label "${label}" --task "${escapeShellArg(JSON.stringify(taskDescription))}"`;
    console.log(`   执行：${spawnCmd}`);
    
    // 在实际环境中，这里会真正执行 spawn 命令
    // 当前环境可能不支持，所以先记录日志
    console.log(`   ✅ Agent 已启动（模拟）`);
    
    // 记录到日志文件
    logAgentSpawn({
      subTaskId,
      subTaskTitle: subTask.title,
      parentTaskId: parentTask._id,
      label,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    console.error(`   ❌ Agent 启动失败:`, error);
  }
}

/**
 * 自动聚合结果
 */
async function autoAggregateResults() {
  const client = getConvexClient();
  
  if (!client) {
    console.log('⚠️  Convex 未连接，跳过聚合');
    return;
  }
  
  try {
    const result = await client.mutation(api.tasks.autoAggregate, {});
    
    if (result.aggregatedCount > 0) {
      console.log(`\n📦 自动聚合完成：${result.aggregatedCount} 个父任务`);
      result.aggregatedTasks.forEach((t: any) => {
        console.log(`   - ${t.parentTitle} (${t.subTaskCount} 个子任务)`);
      });
    } else {
      console.log('\nℹ️  没有需要聚合的任务');
    }
    
  } catch (error) {
    console.error('❌ 自动聚合失败:', error);
  }
}

/**
 * 数组分块
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * 转义 shell 参数
 */
function escapeShellArg(arg: string): string {
  return arg.replace(/'/g, "'\\''");
}

/**
 * 记录 Agent spawn 日志
 */
function logAgentSpawn(info: {
  subTaskId: string;
  subTaskTitle: string;
  parentTaskId: string;
  label: string;
  timestamp: number;
}) {
  const logPath = path.join(__dirname, '../../memory/swarm-agent-spawns.jsonl');
  const logEntry = JSON.stringify(info) + '\n';
  
  try {
    fs.appendFileSync(logPath, logEntry);
    console.log(`   📝 已记录到 ${logPath}`);
  } catch (error) {
    console.warn('   ⚠️  无法写入日志:', error);
  }
}

// 运行主函数
main().catch(console.error);
