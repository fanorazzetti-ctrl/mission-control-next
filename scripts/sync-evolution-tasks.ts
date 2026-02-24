/**
 * Sync Evolution Tasks from EVOLUTION-QUEUE.md to Convex
 * 
 * This script:
 * 1. Reads EVOLUTION-QUEUE.md
 * 2. Parses pending tasks (status: ⏳ 待处理)
 * 3. Creates tasks in Convex tasks table
 * 4. Marks with tags: ["evolution", priority]
 * 5. Avoids duplicates via contentHash
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { readFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import * as path from "path";

// Initialize Convex client
const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  console.warn("CONVEX_URL not set, running in mock mode");
}
const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;

// Configuration
const WORKSPACE_ROOT = process.env.HOME 
  ? path.join(process.env.HOME, "openclaw/workspace")
  : "/home/admin/openclaw/workspace";
const EVOLUTION_QUEUE_PATH = path.join(WORKSPACE_ROOT, "EVOLUTION-QUEUE.md");

// Task interface matching Convex schema
interface EvolutionTask {
  priority: string;
  title: string;
  source: string;
  status: string;
  createdDate: string;
  retryCount: number;
}

/**
 * Generate content hash for idempotency check
 */
function generateContentHash(task: EvolutionTask): string {
  const content = `${task.priority}|${task.title}|${task.source}|${task.createdDate}`;
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Parse EVOLUTION-QUEUE.md markdown table
 */
function parseEvolutionQueue(content: string): EvolutionTask[] {
  const tasks: EvolutionTask[] = [];
  
  // Find the "待执行任务" section
  const sectionMatch = content.match(/## 📋 待执行任务\s*\n([\s\S]*?)(?=\n## |\n$)/);
  if (!sectionMatch) {
    console.warn("Could not find '待执行任务' section");
    return tasks;
  }
  
  const tableContent = sectionMatch[1];
  const lines = tableContent.split("\n");
  
  // Skip header lines (first 2-3 lines are table headers)
  for (const line of lines) {
    // Skip empty lines, headers, and separators
    if (!line.trim() || line.includes("|---") || line.includes("| 优先级")) {
      continue;
    }
    
    // Parse table row: | P1 | Task | Source | Status | Date | retryCount |
    const match = line.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
    if (!match) {
      continue;
    }
    
    const [, priority, title, source, status, createdDate, retryCountStr] = match;
    
    // Only process pending tasks (⏳ 待处理)
    if (!status.includes("⏳ 待处理")) {
      continue;
    }
    
    // Clean up title (remove bold markers)
    const cleanTitle = title.replace(/\*\*/g, "").trim();
    
    tasks.push({
      priority: priority.trim(),
      title: cleanTitle,
      source: source.trim(),
      status: status.trim(),
      createdDate: createdDate.trim(),
      retryCount: parseInt(retryCountStr.trim()) || 0,
    });
  }
  
  return tasks;
}

/**
 * Sync tasks to Convex
 */
async function syncTasks(): Promise<{ synced: number; skipped: number; errors: number }> {
  const stats = { synced: 0, skipped: 0, errors: 0 };
  
  // Read EVOLUTION-QUEUE.md
  if (!existsSync(EVOLUTION_QUEUE_PATH)) {
    console.error(`EVOLUTION-QUEUE.md not found at ${EVOLUTION_QUEUE_PATH}`);
    return stats;
  }
  
  const content = readFileSync(EVOLUTION_QUEUE_PATH, "utf-8");
  const tasks = parseEvolutionQueue(content);
  
  console.log(`Found ${tasks.length} pending evolution tasks`);
  
  if (!convex) {
    console.log("Mock mode - would sync tasks:");
    tasks.forEach(task => {
      console.log(`  - [${task.priority}] ${task.title}`);
    });
    return { synced: tasks.length, skipped: 0, errors: 0 };
  }
  
  // Sync each task
  for (const task of tasks) {
    try {
      const contentHash = generateContentHash(task);
      
      // Check if task already exists (by contentHash)
      // Note: We need to query tasks and check manually since Convex doesn't support
      // querying by optional field with index directly for this use case
      const existingTasks = await convex.query(api.tasks.list);
      const exists = existingTasks.some((t: any) => 
        t.tags?.includes("evolution") && 
        t.contentHash === contentHash
      );
      
      if (exists) {
        console.log(`⏭️  Skipped (duplicate): ${task.title}`);
        stats.skipped++;
        continue;
      }
      
      // Map priority to Convex priority
      const priorityMap: Record<string, "low" | "medium" | "high"> = {
        "P0": "high",
        "P1": "medium",
        "P2": "low",
        "P3": "low",
      };
      const convexPriority = priorityMap[task.priority] || "medium";
      
      // Create task in Convex
      await convex.mutation(api.tasks.create, {
        title: task.title,
        description: `Source: ${task.source}\nCreated: ${task.createdDate}\nRetry Count: ${task.retryCount}`,
        priority: convexPriority,
        tags: ["evolution", task.priority, task.source.split(" ")[0]],
      });
      
      console.log(`✅ Synced: [${task.priority}] ${task.title}`);
      stats.synced++;
      
    } catch (error) {
      console.error(`❌ Error syncing task "${task.title}":`, error);
      stats.errors++;
    }
  }
  
  return stats;
}

/**
 * Main execution
 */
async function main() {
  console.log("🔄 Starting evolution task sync...\n");
  
  const startTime = Date.now();
  const stats = await syncTasks();
  const duration = Date.now() - startTime;
  
  console.log("\n📊 Sync Summary:");
  console.log(`  ✅ Synced: ${stats.synced}`);
  console.log(`  ⏭️  Skipped: ${stats.skipped}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  console.log(`  ⏱️  Duration: ${duration}ms`);
  
  // Exit with error code if there were errors
  if (stats.errors > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { syncTasks, parseEvolutionQueue, generateContentHash };
