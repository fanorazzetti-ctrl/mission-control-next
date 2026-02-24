# Convex 部署与集成完整指南

## 📋 前置准备

确保你已完成：
- ✅ Node.js 18+ 已安装
- ✅ 项目依赖已安装 (`npm install`)
- ✅ 前端代码已更新（Providers + 实时数据集成）

---

## 🚀 步骤 1: 登录 Convex

在终端运行：

```bash
cd ~/openclaw/workspace/mission-control-next
npx convex login
```

这会打开浏览器，使用 GitHub/Google/邮箱登录。

---

## 🚀 步骤 2: 部署 Convex 项目

```bash
npx convex dev
```

首次运行会提示：
1. **创建新项目** → 输入 `mission-control-next`
2. **选择部署区域** → 推荐选最近的（如 `ap-southeast-1` 新加坡）
3. **确认部署** → 按 Enter

部署成功后会显示：
```
✓ Deployed!
✓ Your deployment URL: https://your-name-abc123.convex.cloud
```

---

## 🚀 步骤 3: 配置环境变量

部署成功后，Convex 会自动创建 `.env.local` 文件。

如果没有，手动创建：

```bash
# 查看部署 URL
npx convex deployment

# 创建 .env.local
echo "NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud" > .env.local
```

---

## 🚀 步骤 4: 推送 Schema 和函数

```bash
# 推送 Convex Schema 和函数
npx convex dev
```

这会：
1. 推送 `convex/schema.ts` 到云端
2. 推送所有 `convex/*.ts` 函数
3. 生成类型定义到 `convex/_generated/`

看到以下输出表示成功：
```
✓ Schema pushed
✓ Functions pushed
✓ Generated types updated
```

---

## 🚀 步骤 5: 重启开发服务器

如果开发服务器已在运行，先停止（Ctrl+C），然后重启：

```bash
npm run dev
```

---

## ✅ 验证集成

1. **打开浏览器** → http://localhost:3000
2. **进入任务看板** → /tasks
3. **添加一个任务** → 输入标题，按 Enter
4. **打开新窗口** → 同样访问 /tasks
5. **观察实时更新** → 新窗口应该自动显示新任务

---

## 🔧 故障排查

### 问题 1: "Cannot find module './_generated/api'"

**原因**: Convex 类型定义未生成

**解决**:
```bash
npx convex dev
# 等待生成完成
```

### 问题 2: "ConvexProvider client is undefined"

**原因**: 环境变量未设置

**解决**:
```bash
cat .env.local
# 确保包含 NEXT_PUBLIC_CONVEX_URL
```

### 问题 3: 任务创建失败

**检查浏览器控制台**，可能错误：
- **401 Unauthorized** → Convex 认证问题，重新 `npx convex login`
- **403 Forbidden** → 部署 URL 错误，检查 `.env.local`
- **Network Error** → 网络问题，检查能否访问 `*.convex.cloud`

---

## 📦 生产部署

### 部署到 Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 添加环境变量（在 Vercel Dashboard）
NEXT_PUBLIC_CONVEX_URL=https://your-prod-deployment.convex.cloud
```

### 部署 Convex 生产环境

```bash
# 部署到生产
npx convex deploy --prod

# 获取生产 URL
npx convex deployment --prod
```

---

## 📚 下一步

1. **同步 OpenClaw 数据** → 编写脚本导入现有任务和记忆
2. **添加 Agent 状态同步** → Arthur 主动更新自己的状态
3. **实现拖拽排序** → 使用 dnd-kit 优化看板体验
4. **开发 P1/P2 模块** → Content Pipeline, Team, Office

---

## 🆘 获取帮助

- [Convex 文档](https://docs.convex.dev/)
- [Next.js 集成指南](https://docs.convex.dev/nextjs)
- [Convex Discord 社区](https://convex.dev/discord)
