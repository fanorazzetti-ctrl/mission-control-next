# 蜂群框架快速入门指南

## 🎯 功能概述

蜂群框架自动将复杂任务分解为多个子任务，并行执行，最后聚合结果。

**核心能力**:
- 📦 自动分解：复杂任务 → 多个子任务
- 🚀 并行执行：spawn 多个 Agent 同时工作
- 📊 结果聚合：自动收集子任务结果
- 💰 贡献计算：自动计算每个 Agent 的贡献度

---

## 🚀 快速开始

### 步骤 1: 创建蜂群任务

在 Mission Control 中创建任务，添加以下标签之一：
- `complex` - 复杂任务
- `swarm_task` - 蜂群任务
- `bounty` - 悬赏任务
- `multi_agent` - 多 Agent 任务

**示例**:
```
标题：调研 Multi-Agent 系统最新进展
描述：收集 2025-2026 年 Multi-Agent 系统的最新研究成果
优先级：high
标签：complex, research, swarm_task
```

### 步骤 2: 触发蜂群处理器

**自动触发**（推荐）:
- 心跳自动执行（每 30 分钟）
- 无需手动操作

**手动触发**:
```bash
# 轮询所有待处理任务
cd ~/openclaw/workspace/mission-control-next
npx tsx scripts/swarm-processor.ts

# 处理指定任务
npx tsx scripts/swarm-processor.ts --taskId <task_id>
```

### 步骤 3: 查看执行结果

**查看日志**:
```bash
# Agent spawn 日志
cat ~/openclaw/workspace/memory/swarm-agent-spawns.jsonl

# 实现报告
cat ~/openclaw/workspace/memory/mc-implementation/swarm-framework-report.md
```

**查看任务状态**:
- 在 Mission Control UI 中查看任务树
- 父任务标签：`swarm_parent`, `decomposed`
- 子任务自动分配给不同 Agent

---

## 📋 分解策略

框架根据任务标签自动选择分解策略：

### 🔬 研究型 (research)
```
父任务：调研 AI Agent 最新进展
├─ 📚 文献调研：收集论文、文章
├─ 🔍 技术调研：分析技术栈、工具
└─ 📊 竞品分析：对比类似项目
```

### 💻 开发型 (development)
```
父任务：实现蜂群框架
├─ 🏗️ 架构设计：系统设计、接口规范
├─ 💻 核心实现：编写代码
└─ 🧪 测试验证：测试、修复 bug
```

### 📈 分析型 (analysis)
```
父任务：分析用户行为数据
├─ 📈 数据收集：采集、清洗数据
├─ 🔬 数据分析：统计分析、可视化
└─ 📝 报告撰写：结论和建议
```

### 📋 通用型 (generic)
```
父任务：完成某项工作
├─ 📋 需求分析：明确需求、验收标准
├─ ⚙️ 执行实施：主要工作
└─ ✅ 验收交付：测试、文档、交付
```

---

## ⚙️ 配置选项

创建 `mission-control-next/swarm-config.json`:

```json
{
  "maxParallelAgents": 3,        // 最大并行 Agent 数（默认 3）
  "autoDecompose": true,         // 自动分解（默认 true）
  "autoAggregate": true,         // 自动聚合（默认 true）
  "taskTypes": [                 // 触发的任务类型
    "complex",
    "swarm_task",
    "bounty",
    "multi_agent"
  ]
}
```

---

## 🧪 测试验证

### 测试场景 1: 自动分解
```bash
# 1. 创建任务（标签：complex, research）
# 2. 运行处理器
npx tsx scripts/swarm-processor.ts
# 3. 验证：检查是否创建 3 个子任务
```

### 测试场景 2: 结果聚合
```bash
# 1. 将所有子任务标记为 done
# 2. 运行处理器
npx tsx scripts/swarm-processor.ts
# 3. 验证：父任务状态变为 done，进度 100%
```

### 测试场景 3: 贡献度计算
```bash
# 1. 创建不同优先级的子任务
# 2. 完成后查看聚合结果
# 3. 验证：contributionRatios 包含每个任务的贡献比例
```

---

## 📊 API 参考

### decomposeTask
分解复杂任务为子任务

```typescript
await convex.mutation(api.tasks.decomposeTask, {
  taskId: "task_id_here",
  decompositionType: "auto" // 或 research/development/analysis/generic
});
```

### aggregateResults
聚合子任务结果

```typescript
await convex.mutation(api.tasks.aggregateResults, {
  parentId: "parent_task_id"
});
```

### autoAggregate
自动扫描并聚合所有完成的蜂群任务

```typescript
await convex.mutation(api.tasks.autoAggregate, {});
```

---

## 🔍 故障排查

### 问题 1: 任务未自动分解
**检查**:
- 任务标签是否包含 `complex/swarm_task/bounty/multi_agent`
- 任务是否已有子任务（避免重复分解）
- 任务状态是否不是 `done`

**解决**:
```bash
# 手动触发分解
npx tsx scripts/swarm-processor.ts --taskId <task_id>
```

### 问题 2: Agent 未启动
**检查**:
- OpenClaw 是否正常运行
- `sessions_spawn` 命令是否可用
- 查看 `memory/swarm-agent-spawns.jsonl` 日志

**解决**:
```bash
# 检查 OpenClaw 状态
openclaw status

# 手动 spawn 测试
openclaw sessions spawn --label "test" --task "test task"
```

### 问题 3: 结果未聚合
**检查**:
- 所有子任务是否都标记为 `done`
- 父任务标签是否包含 `swarm_parent`

**解决**:
```bash
# 手动触发聚合
npx tsx scripts/swarm-processor.ts
```

---

## 💡 最佳实践

1. **明确任务类型**: 创建任务时添加准确的标签（research/development/analysis）
2. **合理设置优先级**: 高优先级子任务会获得更高贡献度
3. **监控执行进度**: 定期检查 `memory/swarm-agent-spawns.jsonl`
4. **避免过度分解**: 简单任务不需要使用蜂群框架
5. **及时验收**: 子任务完成后及时验收，触发聚合

---

## 📚 相关文档

- [实现报告](./swarm-framework-report.md) - 详细实现文档
- [胶囊信息](../../memory/evomap-capsules/635e208df07e189e.md) - EvoMap 胶囊原文
- [心跳配置](../../HEARTBEAT.md) - 心跳集成说明

---

## 🎓 示例项目

### 示例 1: 技术调研任务
```
标题：调研 RAG 技术最新进展
标签：complex, research, swarm_task
分解：文献调研 + 技术调研 + 竞品分析
预期时间：3 小时（并行）
```

### 示例 2: 功能开发任务
```
标题：实现用户认证系统
标签：complex, development, coding, swarm_task
分解：架构设计 + 核心实现 + 测试验证
预期时间：6 小时（并行）
```

### 示例 3: 数据分析任务
```
标题：分析用户留存率
标签：complex, analysis, data, swarm_task
分解：数据收集 + 数据分析 + 报告撰写
预期时间：4 小时（并行）
```

---

**最后更新**: 2026-02-24  
**版本**: 1.0.0  
**维护者**: Arthur (Mission Control Team)
