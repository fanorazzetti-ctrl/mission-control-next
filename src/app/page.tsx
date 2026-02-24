import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            🖥️ Mission Control
          </h1>
          <p className="text-xl text-muted-foreground">
            OpenClaw 专属控制台 - 让 AI 代理从对话助手变成可运营的系统
          </p>
        </div>

        {/* 模块网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <ModuleCard
            href="/tasks"
            icon="📋"
            title="任务看板"
            description="追踪任务和 Agent 工作状态，实时更新进度"
            priority="P0"
            status="completed"
          />
          <ModuleCard
            href="/calendar"
            icon="📅"
            title="日历"
            description="Cron Jobs 和定时任务的审计面板"
            priority="P0"
            status="completed"
          />
          <ModuleCard
            href="/memory"
            icon="🧠"
            title="记忆库"
            description="可搜索的记忆文档，像查资料一样检索历史"
            priority="P0"
            status="completed"
          />
          <ModuleCard
            href="/pipeline"
            icon="🔄"
            title="内容流水线"
            description="Idea → Script → Thumbnail → Filming → Publish"
            priority="P1"
            status="completed"
          />
          <ModuleCard
            href="/team"
            icon="👥"
            title="团队结构"
            description="Sub-agents 组织结构：开发/写作/设计"
            priority="P1"
            status="completed"
          />
          <ModuleCard
            href="/office"
            icon="🏢"
            title="数字办公室"
            description="Agent 实时状态总览，头像 + 工位展示"
            priority="P2"
            status="completed"
          />
        </div>

        {/* 项目状态 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>🚀 开发进度</CardTitle>
              <CardDescription>全部 6 个模块已完成</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <StatusItem done>Convex Schema 设计</StatusItem>
                <StatusItem done>Tasks API 实现</StatusItem>
                <StatusItem done>Agents API 实现</StatusItem>
                <StatusItem done>Memories API 实现</StatusItem>
                <StatusItem done>Tasks Board 前端</StatusItem>
                <StatusItem done>Calendar 前端</StatusItem>
                <StatusItem done>Memory 前端</StatusItem>
                <StatusItem done>Content Pipeline 模块</StatusItem>
                <StatusItem done>Team 团队结构</StatusItem>
                <StatusItem done>Office 数字办公室</StatusItem>
                <StatusItem>Convex 部署验证（待手动）</StatusItem>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📚 快速开始</CardTitle>
              <CardDescription>下一步操作指南</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">1. 部署 Convex</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  注册 Convex 账户并部署项目
                </p>
                <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                  npx convex dev
                </code>
              </div>
              <div>
                <h4 className="font-semibold mb-2">2. 集成实时数据</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  参考集成指南添加 Convex Provider
                </p>
                <Link href="/CONVEX-SETUP.md">
                  <Button variant="outline" size="sm">
                    查看集成指南 →
                  </Button>
                </Link>
              </div>
              <div>
                <h4 className="font-semibold mb-2">3. 启动开发服务器</h4>
                <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                  npm run dev
                </code>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 页脚 */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Built with Next.js 15 + Convex + Tailwind CSS</p>
          <p className="mt-2">
            <Link href="https://docs.convex.dev" className="hover:underline">
              Convex 文档
            </Link>
            {" | "}
            <Link href="https://nextjs.org" className="hover:underline">
              Next.js 文档
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function ModuleCard({
  href,
  icon,
  title,
  description,
  priority,
  status,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  priority: string;
  status: "completed" | "in_progress" | "todo";
}) {
  const priorityColors: Record<string, string> = {
    P0: "bg-red-100 text-red-800",
    P1: "bg-yellow-100 text-yellow-800",
    P2: "bg-green-100 text-green-800",
  };

  const statusIcons = {
    completed: "✅",
    in_progress: "🔨",
    todo: "⏸️",
  };

  return (
    <Link href={href}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between mb-4">
            <span className="text-4xl">{icon}</span>
            <div className="flex gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[priority]}`}
              >
                {priority}
              </span>
              <span className="text-xl">{statusIcons[status]}</span>
            </div>
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function StatusItem({
  done,
  children,
}: {
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{done ? "✅" : "⏸️"}</span>
      <span className={done ? "text-muted-foreground" : ""}>{children}</span>
    </div>
  );
}
