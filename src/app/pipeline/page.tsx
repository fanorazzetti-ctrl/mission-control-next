"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const stages = [
  { id: "idea", title: "💡 灵感", color: "bg-purple-50" },
  { id: "script", title: "📝 脚本", color: "bg-blue-50" },
  { id: "thumbnail", title: "🎨 缩略图", color: "bg-pink-50" },
  { id: "filming", title: "🎬 制作", color: "bg-orange-50" },
  { id: "publish", title: "🚀 发布", color: "bg-green-50" },
];

const items = [
  { _id: "1", title: "Mission Control 介绍视频", stage: "script", createdAt: Date.now() },
  { _id: "2", title: "Arthur AGI 进化体系", stage: "idea", createdAt: Date.now() },
];

export default function PipelinePage() {
  const [newItemTitle, setNewItemTitle] = useState("");
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">🔄 内容流水线</h1>
          <p className="text-muted-foreground mt-1">Idea → Script → Thumbnail → Filming → Publish</p>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {stages.map((stage) => (
            <div key={stage.id} className={`${stage.color} rounded-lg p-4 border min-h-[500px]`}>
              <h2 className="font-semibold mb-4">{stage.title}</h2>
              <div className="space-y-3">
                {items.filter((i) => i.stage === stage.id).map((item) => (
                  <Card key={item._id}>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{item.title}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
