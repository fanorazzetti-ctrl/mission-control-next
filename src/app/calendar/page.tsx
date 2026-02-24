"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const cronJobs = [
  { _id: "1", name: "GitHub 任务轮询", cronExpression: "*/5 * * * *", status: "paused", lastRun: Date.now() - 3600000, nextRun: null },
  { _id: "2", name: "Arthur 日报", cronExpression: "50 23 * * *", status: "active", lastRun: Date.now() - 86400000, nextRun: Date.now() + 86400000 },
  { _id: "3", name: "每小时自学习", cronExpression: "0 * * * *", status: "active", lastRun: Date.now() - 3600000, nextRun: Date.now() + 3600000 },
];

export default function CalendarPage() {
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">📅 日历</h1>
          <p className="text-muted-foreground mt-1">Cron Jobs 和定时任务的审计面板</p>
        </div>
        <div className="space-y-4">
          {cronJobs.map((job) => (
            <Card key={job._id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold">{job.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${job.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {job.status === "active" ? "✅ 运行中" : "⏸️ 已暂停"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{job.cronExpression}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">▶️ 立即执行</Button>
                  <Button variant={job.status === "active" ? "outline" : "default"} size="sm">
                    {job.status === "active" ? "暂停" : "启用"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
