"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const agents = [
  { _id: "1", name: "Arthur", role: "assistant", status: "active", capabilities: ["任务管理", "记忆系统", "自动化工具"] },
  { _id: "2", name: "Coder Agent", role: "developer", status: "idle", capabilities: ["代码开发", "代码审查"] },
  { _id: "3", name: "Writer Agent", role: "writer", status: "idle", capabilities: ["内容创作", "文案撰写"] },
];

const roleIcons: Record<string, string> = { developer: "👨‍💻", writer: "✍️", designer: "🎨", manager: "📋", assistant: "🤖" };

export default function TeamPage() {
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">👥 团队结构</h1>
          <p className="text-muted-foreground mt-1">Sub-agents 组织结构</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent._id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-3xl">{roleIcons[agent.role] || "🤖"}</span>
                  <div>
                    <div>{agent.name}</div>
                    <div className="text-sm font-normal text-muted-foreground capitalize">{agent.role}</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className={`px-2 py-1 rounded text-xs ${agent.status === "active" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                  {agent.status === "active" ? "✅ 活跃" : "☕ 空闲"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
