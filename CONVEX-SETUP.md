# Convex 集成指南

## 步骤 1: 注册 Convex 账户

访问 https://convex.dev 注册免费账户。

## 步骤 2: 部署项目

```bash
cd ~/openclaw/workspace/mission-control-next

# 登录并部署
npx convex dev
```

首次运行会提示：
1. 选择登录方式（GitHub/Google/邮箱）
2. 创建新项目或选择现有项目
3. 选择部署区域（推荐选最近的）

## 步骤 3: 获取部署 URL

部署成功后，在 `convex/_generated/api.js` 中会包含部署信息。

或者访问 Convex Dashboard 查看部署 URL。

## 步骤 4: 前端集成

### 4.1 安装 Convex React 客户端

```bash
npm install convex
```

### 4.2 配置 Provider

修改 `src/app/layout.tsx`:

```tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ConvexProvider client={convex}>
          {children}
        </ConvexProvider>
      </body>
    </html>
  );
}
```

### 4.3 添加环境变量

创建 `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### 4.4 使用 useQuery 替换模拟数据

修改 `src/app/tasks/page.tsx`:

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// 替换模拟数据
const tasks = useQuery(api.tasks.list) || [];

// 使用 mutation
const createTask = useMutation(api.tasks.create);
const updateStatus = useMutation(api.tasks.updateStatus);
```

## 步骤 5: 测试实时同步

1. 打开两个浏览器窗口
2. 在一个窗口添加/移动任务
3. 观察另一个窗口是否实时更新

## 步骤 6: 部署生产环境

```bash
# 部署到生产
npx convex deploy

# 更新环境变量为生产 URL
NEXT_PUBLIC_CONVEX_URL=https://your-prod-deployment.convex.cloud
```

## 故障排查

### 问题：无法连接 Convex

- 检查 `.env.local` 中的 URL 是否正确
- 确认网络可以访问 `*.convex.cloud`
- 检查 Convex 账户是否活跃

### 问题：TypeScript 类型错误

- 运行 `npx convex codegen` 重新生成类型
- 确保 `convex/` 目录下的代码没有类型错误

## 参考资源

- [Convex 文档](https://docs.convex.dev/)
- [Next.js 集成指南](https://docs.convex.dev/nextjs)
- [React Hooks 使用](https://docs.convex.dev/react/react-hooks)
