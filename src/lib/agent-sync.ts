/**
 * Arthur Agent 状态同步工具
 * 
 * 用于 Arthur 向 Mission Control 报告自己的状态
 * 状态包括：idle, working, offline
 */

import { ConvexClient } from "convex/browser";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const api = require(path.join(process.cwd(), "convex/_generated/api.js")).api;

export type AgentStatus = 'idle' | 'working' | 'offline';

export class AgentSync {
  private client: ConvexClient | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private agentName: string;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelayMs = 2000;

  constructor(agentName: string = 'Arthur') {
    this.agentName = agentName;
  }

  /**
   * 初始化 Convex Client
   */
  private initClient(): ConvexClient {
    if (!this.client) {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        console.warn('[AgentSync] CONVEX_URL not configured, running in mock mode');
        // 返回一个 mock client
        return this.createMockClient();
      }
      this.client = new ConvexClient(convexUrl);
    }
    return this.client;
  }

  /**
   * 创建 Mock Client（用于未部署 Convex 时）
   */
  private createMockClient(): ConvexClient {
    const mockClient = {
      mutation: async (_api: any, _args: any) => {
        console.log('[AgentSync Mock]', _api, _args);
        return Promise.resolve({ success: true });
      },
      query: async (_api: any, _args: any) => {
        console.log('[AgentSync Mock Query]', _api, _args);
        return Promise.resolve([]);
      },
      close: () => {
        console.log('[AgentSync Mock] Close');
      }
    } as unknown as ConvexClient;
    return mockClient;
  }

  /**
   * 报告状态到 Mission Control
   * @param status 状态：idle | working | offline
   * @param currentTask 当前任务描述（可选）
   */
  async reportStatus(status: AgentStatus, currentTask?: string): Promise<boolean> {
    try {
      const client = this.initClient();
      
      await client.mutation(api.teamMembers.updateStatus, {
        name: this.agentName,
        status,
        lastActiveAt: Date.now()
      });

      this.retryCount = 0; // 成功后重置重试计数
      console.log(`[AgentSync] Status reported: ${this.agentName} -> ${status}`, currentTask ? `(${currentTask})` : '');
      return true;
    } catch (error) {
      console.error('[AgentSync] Failed to report status:', error);
      this.retryCount++;
      
      if (this.retryCount < this.maxRetries) {
        console.log(`[AgentSync] Retrying in ${this.retryDelayMs}ms... (${this.retryCount}/${this.maxRetries})`);
        await this.sleep(this.retryDelayMs);
        return this.reportStatus(status, currentTask);
      } else {
        console.error('[AgentSync] Max retries reached, giving up');
        return false;
      }
    }
  }

  /**
   * 启动心跳（定期报告状态）
   * @param intervalMs 心跳间隔（毫秒），默认 30 分钟
   */
  startHeartbeat(intervalMs: number = 30 * 60 * 1000): void {
    if (this.heartbeatInterval) {
      console.log('[AgentSync] Heartbeat already running');
      return;
    }

    console.log(`[AgentSync] Starting heartbeat (interval: ${intervalMs}ms)`);
    
    // 立即执行一次
    this.heartbeatTick();
    
    // 定期执行
    this.heartbeatInterval = setInterval(() => {
      this.heartbeatTick();
    }, intervalMs);
  }

  /**
   * 停止心跳
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[AgentSync] Heartbeat stopped');
    }
  }

  /**
   * 心跳执行逻辑
   */
  private async heartbeatTick(): Promise<void> {
    try {
      // 检查当前是否有运行中的任务
      const hasActiveTask = await this.checkActiveTask();
      const status: AgentStatus = hasActiveTask ? 'working' : 'idle';
      const currentTask = hasActiveTask ? await this.getCurrentTaskName() : undefined;

      await this.reportStatus(status, currentTask);
    } catch (error) {
      console.error('[AgentSync] Heartbeat tick failed:', error);
    }
  }

  /**
   * 检查是否有活跃任务
   * 实际实现需要读取任务队列或当前执行状态
   */
  private async checkActiveTask(): Promise<boolean> {
    // TODO: 实现任务检查逻辑
    // 可以检查：
    // 1. 当前 session 是否有运行中的 subagent
    // 2. 是否有 pending 的 GitHub issues
    // 3. 是否有执行中的脚本
    
    // 临时返回 false（idle 状态）
    return false;
  }

  /**
   * 获取当前任务名称
   */
  private async getCurrentTaskName(): Promise<string | undefined> {
    // TODO: 实现任务名称获取逻辑
    return undefined;
  }

  /**
   * 休眠工具函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 注册 Agent 到 Mission Control（首次启动时调用）
   */
  async register(capabilities: string[] = []): Promise<boolean> {
    try {
      const client = this.initClient();
      
      await client.mutation(api.teamMembers.register, {
        name: this.agentName,
        role: 'assistant',
        capabilities,
        status: 'idle'
      });

      console.log(`[AgentSync] Agent registered: ${this.agentName}`);
      return true;
    } catch (error) {
      console.error('[AgentSync] Failed to register agent:', error);
      return false;
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.stopHeartbeat();
    if (this.client) {
      // ConvexClient 没有 close 方法，但为了接口一致性保留
      console.log('[AgentSync] Connection closed');
    }
  }
}

// 导出单例实例（方便脚本使用）
export const arthurSync = new AgentSync('Arthur');
