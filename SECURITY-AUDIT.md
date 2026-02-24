# Mission Control Next - 安全审计报告 (Security Audit Report)

## 1. 审计概览

### 1.1 基本信息
- **审计日期**: 2026-02-23
- **审计工具**: Gemini CLI (gemini-3.1-pro-preview)
- **审计范围**: 认证授权、XSS/CSRF、API 注入、敏感数据、输入验证
- **审计者**: QA Test & Code Review Agent

### 1.2 风险评级汇总

| 风险等级 | 数量 | 状态 |
|----------|------|------|
| 🔴 高风险 | 2 | 未修复 |
| 🟡 中风险 | 2 | 未修复 |
| 🟢 低风险 | 1 | 已缓解 |

### 1.3 综合安全评分

**安全评分**: **4/10** - 🔴 **严重不足，不适合公网部署**

---

## 2. 详细审计结果

### 2.1 Convex 权限配置

**风险等级**: 🔴 **高 (High)**

#### 发现
项目中的所有 Convex Mutations 和 Queries **完全缺乏认证 (Authentication) 和授权 (Authorization) 检查**。

虽然 `package.json` 中已安装 `@convex-dev/auth`，但在任何后端的 `handler` 函数中都没有调用 `ctx.auth.getUserIdentity()` 或类似逻辑。

**受影响文件**:
- `convex/tasks.ts` - 所有任务操作
- `convex/agents.ts` - 所有 Agent 操作
- `convex/memories.ts` - 所有记忆操作
- `convex/calendar.ts` - 所有日历操作
- `convex/pipeline.ts` - 所有流水线操作

#### 影响
任何拥有 `NEXT_PUBLIC_CONVEX_URL` 的客户端都可以：
- ✅ 读取所有任务、记忆、Agent 数据
- ✅ 创建、更新、删除任意数据
- ✅ 冒充任意 Agent 上报状态
- ✅ 篡改 Cron Job 配置

#### 修复建议

**步骤 1: 配置 Convex Auth**
```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_AUTH_DOMAIN,
      applicationID: process.env.CONVEX_AUTH_APPLICATION_ID,
    },
  ],
};
```

**步骤 2: 添加身份验证检查**
```typescript
// convex/tasks.ts
export const create = mutation({
  args: {...},
  handler: async (ctx, args) => {
    // 强制身份验证
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated call");
    }
    
    // 可选：检查特定权限
    // if (!identity.email?.endsWith('@company.com')) {
    //   throw new Error("Unauthorized");
    // }
    
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {...});
    return { success: true, taskId };
  },
});
```

**步骤 3: 实现 RBAC 权限控制**
```typescript
// convex/agents.ts
export const updateStatus = mutation({
  args: {...},
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    // 检查是否为 Agent 本人或管理员
    const agent = await ctx.db
      .query("agents")
      .filter(q => q.eq(q.field("name"), args.agentName))
      .first();
    
    if (!agent) throw new Error("Agent not found");
    
    // 可选：检查用户是否有权更新此 Agent
    // if (identity.subject !== agent.ownerId && !isAdmin(identity)) {
    //   throw new Error("Unauthorized");
    // }
    
    await ctx.db.patch(agent._id, {...});
    return { success: true };
  },
});
```

---

### 2.2 XSS/CSRF 风险

**风险等级**: 🟡 **中 (Medium)**

#### 发现

**XSS (跨站脚本攻击)**:
- ✅ 全局代码库中未发现使用 `dangerouslySetInnerHTML`
- ✅ React/Next.js 默认会对数据绑定进行 HTML 转义
- ⚠️ **潜在风险**: `avatarUrl` 等外部链接字段未进行协议清洗

**CSRF (跨站请求伪造)**:
- ✅ 应用依赖 Convex 的 WebSocket/RPC 通信，而非传统 Cookie/Session
- ✅ 当前系统尚未引入认证机制，CSRF 暂无实际影响
- ⚠️ **注意**: 一旦引入 Auth，Convex 自带的 Token 机制天生能够抵御 CSRF

#### 影响
- 攻击者可能通过 `avatarUrl` 字段注入 `javascript:alert(1)` 等恶意 URI
- 前端直接渲染未清洗的 URL 可能触发 XSS

#### 修复建议

**URL 协议清洗**:
```typescript
// lib/url-utils.ts
export function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    // 阻止 javascript:, data:, vbscript: 等危险协议
    return undefined;
  } catch {
    return undefined;
  }
}

// 使用示例
<img src={sanitizeUrl(agent.avatarUrl) || '/default-avatar.png'} />
```

**CSP (Content Security Policy)**:
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-eval';",
          },
        ],
      },
    ];
  },
};
```

---

### 2.3 API 注入风险

**风险等级**: 🟡 **中 (Medium)**

#### 发现

**NoSQL 注入防御**:
- ✅ Convex 底层采用类型安全的 `v` 校验器
- ✅ 使用预编译的查询结构
- ✅ 几乎不存在传统的 SQL/NoSQL 字符串拼接注入风险

**资源耗尽 (DoS) 风险**:
- 🔴 **未限制输入长度**: `memories.ts` 和 `tasks.ts` 接口无长度验证
- 🔴 **无防刷/速率限制**: 未发现限制请求频次的逻辑

#### 影响
- 攻击者可通过 API 传入超大体积的 `content` 或 `description` (如 10MB 字符串)
- 导致数据库存储资源耗尽和带宽阻塞
- 高频请求可能导致服务不可用

#### 修复建议

**输入长度验证**:
```typescript
// convex/tasks.ts
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    // ...
  },
  handler: async (ctx, args) => {
    // 长度验证
    if (args.title.length > 200) {
      throw new Error("Title length exceeds maximum limit (200 chars)");
    }
    if (args.description && args.description.length > 5000) {
      throw new Error("Description length exceeds maximum limit (5000 chars)");
    }
    
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {...});
    return { success: true, taskId };
  },
});

// convex/memories.ts
export const add = mutation({
  args: {
    content: v.string(),
    // ...
  },
  handler: async (ctx, args) => {
    if (args.content.length > 10000) {
      throw new Error("Content length exceeds maximum limit (10000 chars)");
    }
    
    const memoryId = await ctx.db.insert("memories", {...});
    return { success: true, memoryId };
  },
});
```

**速率限制 (Rate Limiting)**:
```typescript
// 使用 Convex 的速率限制功能
// convex/rateLimit.ts
import { rateLimit } from "convex/rate-limit";

export const createTask = mutation({
  args: {...},
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    // 限制每个用户每分钟最多创建 10 个任务
    await rateLimit(ctx, {
      key: `createTask:${identity.subject}`,
      limit: 10,
      windowMs: 60000, // 1 分钟
    });
    
    // ... 创建逻辑
  },
});
```

---

### 2.4 敏感数据保护

**风险等级**: 🟢 **低 (Low)**

#### 发现
- ✅ 未发现硬编码的敏感数据 (API Keys, Secret Tokens, 私钥)
- ✅ `.env` 和 `.env.local` 已被 `.gitignore` 妥善排除
- ✅ 唯一暴露的环境变量是 `NEXT_PUBLIC_CONVEX_URL`，这是 Convex 客户端架构的公开配置参数

#### 影响
当前敏感数据保护措施得当，无明显风险。

#### 建议
- ✅ 保持目前的环境变量隔离机制
- ⚠️ 未来如需在服务端引入 OpenAI API Key 等数据：
  - 只使用私密环境变量（无 `NEXT_PUBLIC_` 前缀）
  - 在 Convex Dashboard 变量管理中进行配置
  - 不要在客户端代码中访问敏感环境变量

---

### 2.5 认证和授权机制

**风险等级**: 🔴 **高 (High)**

#### 发现
- 🔴 **身份验证完全缺失**: 系统没有用户登录拦截机制
- 🔴 **授权机制完全缺失**: 任何人都可以执行任何操作
- ⚠️ 虽然定义了 `role` 字段 (developer, writer, manager 等)，但这只是前端状态区分，**没有后端权限边界**

#### 影响
- 任何人都能匿名注册 Agent
- 任何人都能更改流水线 (Pipeline) 状态
- 任何人都能清除全部内容池
- 无任何审计日志追踪操作者

#### 修复建议

**紧急零信任改造**:

**步骤 1: 选择认证提供商**
```bash
# 选项 1: Convex Auth (推荐)
npm install @convex-dev/auth

# 选项 2: Clerk
npm install @clerk/nextjs

# 选项 3: NextAuth.js
npm install next-auth
```

**步骤 2: 配置认证**
```typescript
// 以 Convex Auth 为例
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_AUTH_DOMAIN,
      applicationID: process.env.CONVEX_AUTH_APPLICATION_ID,
    },
  ],
};

// src/app/providers.tsx
import { ConvexAuthProvider } from "@convex-dev/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
```

**步骤 3: 实现 RBAC 模型**
```typescript
// convex/permissions.ts
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  DEVELOPER: "developer",
  WRITER: "writer",
  ASSISTANT: "assistant",
} as const;

export const PERMISSIONS = {
  [ROLES.ADMIN]: ["*"], // 所有权限
  [ROLES.MANAGER]: ["tasks:*", "agents:*", "calendar:*"],
  [ROLES.DEVELOPER]: ["tasks:read", "tasks:create", "tasks:update"],
  [ROLES.WRITER]: ["tasks:read", "memories:*"],
  [ROLES.ASSISTANT]: ["tasks:read", "agents:updateStatus"],
};

export function hasPermission(role: string, action: string): boolean {
  const permissions = PERMISSIONS[role as keyof typeof PERMISSIONS];
  if (!permissions) return false;
  return permissions.includes("*") || permissions.includes(action);
}

// 在 mutation 中使用
export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    const userRole = identity.role as string; // 从 identity 中获取角色
    if (!hasPermission(userRole, "tasks:delete")) {
      throw new Error("Unauthorized: insufficient permissions");
    }
    
    await ctx.db.delete(args.taskId);
    return { success: true };
  },
});
```

---

## 3. 安全风险评估矩阵

| 风险项 | 可能性 | 影响程度 | 风险等级 | 优先级 |
|--------|--------|----------|----------|--------|
| 未授权访问 | 极高 | 极高 | 🔴 高 | P0 |
| 数据篡改 | 极高 | 极高 | 🔴 高 | P0 |
| 资源耗尽 (DoS) | 中 | 高 | 🟡 中 | P1 |
| XSS 攻击 | 低 | 中 | 🟡 中 | P1 |
| CSRF 攻击 | 低 | 低 | 🟢 低 | P2 |
| 敏感数据泄露 | 低 | 高 | 🟢 低 | P2 |

---

## 4. 修复优先级

### 🔴 P0 - 立即修复 (发布前必须完成)

1. **集成认证授权机制**
   - 预计工时: 1-2 天
   - 负责人: 开发团队
   - 验收标准: 所有 API 需要身份验证，未认证请求返回 401

2. **添加输入长度限制**
   - 预计工时: 2-4 小时
   - 负责人: 开发团队
   - 验收标准: 所有 mutation 有长度验证，超长输入返回 400

### 🟡 P1 - 近期修复 (1 周内完成)

1. **URL 协议清洗**
   - 预计工时: 1-2 小时
   - 负责人: 前端开发
   - 验收标准: 所有外部链接经过 `sanitizeUrl()` 处理

2. **实现 RBAC 权限控制**
   - 预计工时: 1-2 天
   - 负责人: 开发团队
   - 验收标准: 不同角色有不同权限，越权操作返回 403

3. **添加速率限制**
   - 预计工时: 2-4 小时
   - 负责人: 后端开发
   - 验收标准: 高频请求被限制，返回 429

### 🟢 P2 - 长期优化 (1 个月内完成)

1. **添加审计日志**
   - 预计工时: 1 天
   - 负责人: 开发团队
   - 验收标准: 所有写操作记录到 `auditLogs` 表

2. **配置 CSP 头**
   - 预计工时: 1-2 小时
   - 负责人: DevOps
   - 验收标准: 响应头包含 Content-Security-Policy

3. **定期安全扫描**
   - 预计工时: 持续
   - 负责人: 安全团队
   - 验收标准: 每周运行安全扫描，发现问题及时修复

---

## 5. 安全基线检查清单

### 5.1 认证授权
- [ ] 所有 API 需要身份验证
- [ ] 实现 RBAC 权限模型
- [ ] 未认证请求返回 401
- [ ] 越权操作返回 403
- [ ] Token 有过期机制

### 5.2 输入验证
- [ ] 所有输入有长度限制
- [ ] 所有输入有格式验证
- [ ] 外部链接经过协议清洗
- [ ] 文件上传有类型和大小限制

### 5.3 输出编码
- [ ] 不使用 `dangerouslySetInnerHTML`
- [ ] 所有动态内容自动转义
- [ ] 配置 CSP 头

### 5.4 数据安全
- [ ] 敏感数据不硬编码
- [ ] 环境变量正确隔离
- [ ] 数据库有备份机制
- [ ] 通信使用 HTTPS

### 5.5 监控审计
- [ ] 记录所有写操作
- [ ] 异常行为告警
- [ ] 定期安全审计
- [ ] 漏洞响应流程

---

## 6. 审计结论

### 6.1 总体评价
Mission Control Next 项目的核心逻辑和通信机制实现得相对整洁，规避了传统 Web 漏洞（如 SQL 注入、XSS）。**但最大的隐患在于后端的开放式裸奔状态**——完全缺乏认证授权机制。

### 6.2 发布建议
**🔴 强烈不建议在当前状态下向公网部署**。

在修复以下 P0 问题前，项目仅适合在受信任的内部环境使用：
1. 集成认证授权机制
2. 添加输入长度限制

### 6.3 后续行动
1. 立即启动认证授权集成工作
2. 完成 P0 修复后进行二次安全审计
3. 逐步完成 P1/P2 修复项
4. 建立定期安全扫描机制

---

*报告版本：v1.0*  
*创建日期: 2026-02-23*  
*审计者：QA Test & Code Review Agent (Gemini CLI)*  
*下次审计建议：修复 P0 问题后*
