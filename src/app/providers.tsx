"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// 支持模拟数据模式（未部署 Convex 时）
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function Providers({ children }: { children: ReactNode }) {
  // 如果没有配置 Convex URL，直接渲染 children（使用模拟数据）
  if (!convexUrl) {
    return <>{children}</>;
  }

  const convex = new ConvexReactClient(convexUrl);
  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}
