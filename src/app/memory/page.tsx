"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const memories = [
  { _id: "1", content: "山乘的 WhatsApp 偏好：只允许回复 +8613291875272", tags: ["配置", "WhatsApp"], source: "chat", createdAt: Date.now() },
  { _id: "2", content: "GitHub 任务轮询已完全禁用（20:15）", tags: ["系统", "GitHub"], source: "task_result", createdAt: Date.now() },
  { _id: "3", content: "Mission Control Next 项目启动，技术栈：Next.js 15 + Convex", tags: ["项目", "Mission Control"], source: "task_result", createdAt: Date.now() },
];

export default function MemoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredMemories = memories.filter((m) =>
    m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const allTags = Array.from(new Set(memories.flatMap((m) => m.tags)));

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">🧠 记忆库</h1>
          <p className="text-muted-foreground mt-1">可搜索的记忆文档</p>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索记忆内容或标签..."
          className="w-full px-4 py-3 border rounded-lg mb-6"
        />
        <div className="space-y-4">
          {filteredMemories.map((memory) => (
            <Card key={memory._id}>
              <CardHeader className="pb-3">
                <div className="flex gap-2 flex-wrap">
                  {memory.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-muted rounded text-xs">#{tag}</span>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{memory.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
