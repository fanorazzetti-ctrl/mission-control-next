# 🖥️ Mission Control Next

OpenClaw 专属控制台 - Next.js + Convex 版本

## PRD 来源

公众号文章：Mission Control - 让 OpenClaw 从对话助手变成可运营的系统

## 技术栈

- **Frontend**: Next.js 15 (App Router)
- **Database**: Convex (实时同步)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Convex Real-time Queries

## 6 大模块

| 模块 | 优先级 | 状态 |
|------|--------|------|
| Tasks Board | P0 | ✅ 完成 |
| Calendar | P0 | ✅ 完成 |
| Memory | P0 | ✅ 完成 |
| Content Pipeline | P1 | ✅ 完成 |
| Team | P1 | ✅ 完成 |
| Office | P2 | ✅ 完成 |

## 快速启动

### 方式一：使用模拟数据（立即启动）

```bash
cd ~/openclaw/workspace/mission-control-next
npm run dev
```

访问 http://localhost:3000

### 方式二：使用 Convex 实时数据（推荐）

```bash
cd ~/openclaw/workspace/mission-control-next

# 1. 登录 Convex
npx convex login

# 2. 部署项目
npx convex dev

# 3. 新终端启动前端
npm run dev
```

访问 http://localhost:3000

详细步骤参考 [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)

## 当前进度

### ✅ Phase 1: 基础设施
- [x] 项目初始化
- [x] Convex Schema 设计
- [x] Tasks API 实现
- [x] Agents API 实现
- [x] Memories API 实现
- [x] 基础页面结构

### ✅ Phase 2: P0 模块 MVP
- [x] Tasks Board 前端（模拟数据）
- [x] Calendar 前端（模拟数据）
- [x] Memory 前端（搜索功能）

### ✅ Phase 3: P1/P2 模块
- [x] Content Pipeline 完整实现
- [x] Team 团队结构管理
- [x] Office 数字办公室视图

### ⏸️ 下一步
1. 部署 Convex 并获取部署 URL
2. 前端集成 Convex 实时数据（代码已就绪）
3. 测试实时同步功能

## 项目结构

```
mission-control-next/
├── convex/              # Convex 后端
│   ├── schema.ts        # 数据模型定义
│   ├── tasks.ts         # 任务 API
│   ├── agents.ts        # Agent API
│   └── memories.ts      # 记忆 API
├── src/app/             # Next.js 页面
│   ├── layout.tsx
│   ├── page.tsx         # 首页（模块导航）
│   ├── tasks/           # 任务看板
│   ├── calendar/        # 日历
│   ├── memory/          # 记忆库
│   ├── pipeline/        # 内容流水线
│   ├── team/            # 团队结构
│   └── office/          # 数字办公室
└── package.json
```

## 开发日志

### 2026-02-23
- 项目创建
- SDD 规范文档完成
- Convex Schema 设计
- P0 模块 MVP 前端完成（模拟数据）

---

**下一步**：部署 Convex，集成实时数据

## 部署指南

### 本地开发
```bash
npm install
npm run dev
```

### Convex 部署
```bash
npx convex login
npx convex dev
```

### 生产环境部署
参考 [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)

## 相关文档

- [SDD.md](./SDD.md) - 系统设计文档
- [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) - 部署指南
- [CONVEX-SETUP.md](./CONVEX-SETUP.md) - Convex 配置指南
- [TEST-PLAN.md](./TEST-PLAN.md) - 测试计划
- [TEST-REPORT.md](./TEST-REPORT.md) - 测试报告
- [SECURITY-AUDIT.md](./SECURITY-AUDIT.md) - 安全审计
- [CODE-REVIEW-REPORT.md](./CODE-REVIEW-REPORT.md) - 代码审查报告

## License

MIT
