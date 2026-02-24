# 数据导入指南

将 OpenClaw 现有的记忆和任务数据导入到 Convex 数据库。

## 📋 前提条件

1. **已部署 Convex 项目**
   ```bash
   cd ~/openclaw/workspace/mission-control-next
   npx convex login
   npx convex dev
   ```

2. **配置 Convex URL**
   
   在 `.env.local` 文件中设置：
   ```bash
   CONVEX_URL=https://your-project.convex.cloud
   ```

## 🚀 使用方法

### 预览导入（推荐先执行）

```bash
cd ~/openclaw/workspace/mission-control-next
npx tsx scripts/import-data.ts --memories --dry-run
```

### 实际导入记忆

```bash
npx tsx scripts/import-data.ts --memories
```

### 导入所有数据（记忆 + 任务）

```bash
npx tsx scripts/import-data.ts --all
```

### 仅预览不导入

```bash
npx tsx scripts/import-data.ts --memories --dry-run
```

## 📊 导入内容

### 记忆数据

从以下位置导入：
- `memory/*.md` - 日常日志文件
- `MEMORY.md` - 长期记忆文件

**数据映射：**
```typescript
{
  content: string,      // Markdown 内容
  tags: string[],       // 从文件名自动提取
  source: "manual" | "chat" | "task_result" | "daily_log" | "system",
  createdAt: number,    // 文件修改时间戳
  contentHash: string   // SHA-256 哈希（用于幂等）
}
```

**标签提取规则：**
- `2026-02-23.md` → `["daily-log", "2026", "2026-02"]`
- `ERROR-LOG.md` → `["error", "system"]`
- `LEARNING_LOG.md` → `["learning", "reflection"]`
- `github-*.md` → `["github", "integration"]`
- `xiaohongshu-*.md` → `["xiaohongshu", "social"]`
- 其他 → `["general"]`

### 任务数据

⚠️ **任务导入功能尚未实现**

计划支持：
- GitHub Issues 导入
- 本地任务文件导入

## 🔒 幂等性保证

脚本通过 `contentHash` 确保幂等性：

1. 计算每个文件内容的 SHA-256 哈希
2. 导入前检查 Convex 中是否已存在相同哈希
3. 如果存在则跳过，避免重复导入

**可以安全重复执行：**
```bash
# 多次执行不会创建重复记录
npx tsx scripts/import-data.ts --memories
npx tsx scripts/import-data.ts --memories  # 第二次会跳过所有已导入的
```

## 📝 导入报告

导入完成后会显示详细报告：

```
============================================================
📊 导入报告
============================================================
总计：   25 个文件
导入：   25 ✅
跳过：   0 ⏭️
失败：   0 ❌
============================================================

✅ 成功导入的文件:
   memory/2026-02-23.md
   memory/2026-02-09.md
   MEMORY.md
   ...

⏱️  总耗时：1.23s

✨ 导入完成！
```

## 🛠️ 故障排除

### Convex 连接失败

**错误：** `Error: Cannot connect to Convex`

**解决：**
1. 确认 Convex 项目已部署：`npx convex dev`
2. 检查 `.env.local` 中的 `CONVEX_URL` 是否正确
3. 确认网络连接正常

### 找不到记忆文件

**错误：** `未找到记忆文件`

**解决：**
1. 确保在 `mission-control-next` 目录下运行
2. 检查 `~/openclaw/workspace/memory/` 目录是否存在
3. 确认有 `.md` 文件

### 导入重复数据

如果意外导入了重复数据：

```bash
# 方法 1：清空 Convex 记忆表（谨慎！）
npx convex run scripts/clear-memories.ts

# 方法 2：手动删除（通过 Convex Dashboard）
# 访问 https://dashboard.convex.cloud
```

## 📚 相关文件

- `scripts/import-data.ts` - 导入脚本
- `convex/memories.ts` - Convex API 定义
- `convex/schema.ts` - 数据库模式（包含 `contentHash` 索引）

## 🎯 最佳实践

1. **始终先运行 dry-run**
   ```bash
   npx tsx scripts/import-data.ts --memories --dry-run
   ```

2. **定期备份 Convex 数据**
   ```bash
   npx convex export > backup.json
   ```

3. **导入后验证数据**
   - 访问 Convex Dashboard 检查记录
   - 在应用前端查看 Memory 模块

4. **增量导入**
   - 脚本自动跳过已存在的记录
   - 可以定期运行以同步新记忆

---

*最后更新：2026-02-23*
