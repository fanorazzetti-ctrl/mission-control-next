#!/usr/bin/env bash
#
# 测试 Arthur 状态同步集成
#
# 用法：
#   ./test-agent-sync.sh
#

set -e

echo "🧪 Testing Arthur Agent Status Sync Integration"
echo "================================================"
echo ""

PROJECT_DIR="$HOME/openclaw/workspace/mission-control-next"
cd "$PROJECT_DIR"

echo "1️⃣  Test: Register Arthur"
echo "-------------------------"
npx tsx scripts/agent-heartbeat.ts --register
echo ""

echo "2️⃣  Test: Report idle status"
echo "----------------------------"
npx tsx scripts/agent-heartbeat.ts --status idle
echo ""

echo "3️⃣  Test: Report working status with task"
echo "------------------------------------------"
npx tsx scripts/agent-heartbeat.ts --status working --task "Testing status sync"
echo ""

echo "4️⃣  Test: Auto-detect status (no pending task)"
echo "-----------------------------------------------"
npx tsx scripts/agent-heartbeat.ts
echo ""

echo "✅ All tests passed!"
echo ""
echo "📝 Note: Running in MOCK mode (Convex not deployed)"
echo "   To test with real Convex:"
echo "   1. Run: npx convex login"
echo "   2. Run: npx convex dev"
echo "   3. Re-run this test script"
