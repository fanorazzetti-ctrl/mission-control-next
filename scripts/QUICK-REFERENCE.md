# 📦 数据导入快速参考

## 一键命令

```bash
cd ~/openclaw/workspace/mission-control-next

# 预览（推荐先执行）
npx tsx scripts/import-data.ts --memories --dry-run

# 实际导入
npx tsx scripts/import-data.ts --memories
```

## 所有命令

| 命令 | 用途 |
|------|------|
| `npx tsx scripts/import-data.ts --memories --dry-run` | 预览导入结果 |
| `npx tsx scripts/import-data.ts --memories` | 导入记忆文件 |
| `npx tsx scripts/import-data.ts --all` | 导入所有数据 |
| `npx tsx scripts/import-data.ts --help` | 显示帮助 |

## 验证导入

```bash
# 查看 Convex 数据
npx convex dashboard

# 查询记忆（在浏览器控制台）
await convex.query(api.memories.list)
```

## 文件位置

- **脚本**: `mission-control-next/scripts/import-data.ts`
- **文档**: `mission-control-next/scripts/README-import.md`
- **完成报告**: `mission-control-next/scripts/IMPORT-COMPLETE.md`

## 常见问题

**Q: 找不到 convex 模块？**  
A: 确保在 `mission-control-next` 目录下运行

**Q: 导入重复数据？**  
A: 脚本自动跳过已存在的记录（通过 contentHash）

**Q: 如何清空已导入的数据？**  
A: 访问 Convex Dashboard 手动删除，或运行 `npx convex run scripts/clear-memories.ts`

---

详细文档：`scripts/README-import.md`
