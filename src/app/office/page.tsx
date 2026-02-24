"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const agents = [
  { _id: "1", name: "Arthur", role: "assistant", status: "working", currentTask: "开发 Mission Control" },
  { _id: "2", name: "Coder Agent", role: "developer", status: "idle", currentTask: null },
];

const tasks = [
  { _id: "1", title: "搭建 Mission Control 项目", status: "in_progress", assigneeName: "Arthur" },
  { _id: "2", title: "集成 Calendar 模块", status: "todo", assigneeName: "" },
];

export default function OfficePage() {
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">🏢 数字办公室</h1>
          <p className="text-muted-foreground mt-1">Agent 实时状态总览</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>💻 工作区</CardTitle></CardHeader>
            <CardContent>
              {agents.filter(a => a.status === "working").map((agent) => (
                <div key={agent._id} className="p-4 border rounded-lg mb-3">
                  <p className="font-semibold">{agent.name}</p>
                  <p className="text-sm text-muted-foreground">{agent.currentTask}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>☕ 休息区</CardTitle></CardHeader>
            <CardContent>
              {agents.filter(a => a.status !== "working").map((agent) => (
                <div key={agent._id} className="p-4 border rounded-lg mb-3">
                  <p className="font-semibold">{agent.name}</p>
                  <p className="text-sm text-muted-foreground">等待分配任务...</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
