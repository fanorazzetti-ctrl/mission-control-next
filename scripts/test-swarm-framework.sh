#!/bin/bash
# 蜂群框架快速测试脚本
# 用法：./test-swarm-framework.sh

set -e

echo "🐝 蜂群框架快速测试"
echo "======================================"

cd ~/openclaw/workspace/mission-control-next

echo ""
echo "1️⃣  测试蜂群处理器脚本..."
npx tsx scripts/swarm-processor.ts

echo ""
echo "2️⃣  检查配置文件..."
if [ -f "swarm-config.json" ]; then
    echo "✅ swarm-config.json 存在"
    cat swarm-config.json
else
    echo "❌ swarm-config.json 不存在"
fi

echo ""
echo "3️⃣  检查实现报告..."
if [ -f "../memory/mc-implementation/swarm-framework-report.md" ]; then
    echo "✅ 实现报告已生成"
    ls -lh ../memory/mc-implementation/swarm-framework-report.md
else
    echo "❌ 实现报告未生成"
fi

echo ""
echo "4️⃣  检查 Convex 任务 API..."
if grep -q "decomposeTask" convex/tasks.ts; then
    echo "✅ decomposeTask 已实现"
else
    echo "❌ decomposeTask 未实现"
fi

if grep -q "aggregateResults" convex/tasks.ts; then
    echo "✅ aggregateResults 已实现"
else
    echo "❌ aggregateResults 未实现"
fi

if grep -q "autoAggregate" convex/tasks.ts; then
    echo "✅ autoAggregate 已实现"
else
    echo "❌ autoAggregate 未实现"
fi

echo ""
echo "5️⃣  检查心跳集成..."
if grep -q "蜂群任务处理" ../HEARTBEAT.md; then
    echo "✅ HEARTBEAT.md 已集成蜂群任务"
else
    echo "❌ HEARTBEAT.md 未集成蜂群任务"
fi

echo ""
echo "======================================"
echo "✅ 所有检查完成！"
echo ""
echo "📋 下一步:"
echo "1. 配置 Convex 环境变量 (NEXT_PUBLIC_CONVEX_URL)"
echo "2. 部署 Convex 函数：npx convex deploy"
echo "3. 创建测试任务并运行蜂群处理器"
echo "4. 验证子任务分解和聚合"
