#!/usr/bin/env tsx
/**
 * 将 OpenClaw 记忆导入 Convex
 * 
 * 使用方法：
 *   cd mission-control-next && npx tsx ../scripts/import-data.ts --memories
 *   cd mission-control-next && npx tsx ../scripts/import-data.ts --dry-run
 * 
 * 注意：此脚本需要在 mission-control-next 目录下运行，以便访问 Convex 依赖
 * 
 * 特性：
 * - 幂等性：通过 content hash 避免重复导入
 * - 详细报告：显示导入进度和统计信息
 * - 错误处理：失败时继续处理其他记录
 */

import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

// ============================================================================
// 配置
// ============================================================================

// 使用 process.cwd() 获取当前工作目录
// 脚本应该在 mission-control-next 目录下运行
const PROJECT_ROOT = process.cwd();
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, "..");
const MEMORY_DIR = path.join(WORKSPACE_ROOT, "memory");
const MEMORY_MD_PATH = path.join(WORKSPACE_ROOT, "MEMORY.md");

// Convex 部署 URL（从环境变量或 .env 文件读取）
const CONVEX_URL = process.env.CONVEX_URL || 
  (() => {
    // 尝试从 .env 文件读取
    const envPath = path.join(WORKSPACE_ROOT, ".env.local");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const match = envContent.match(/CONVEX_URL=(.+)/);
      if (match) return match[1].trim();
    }
    return "https://beaming-bandicoot-192.convex.cloud";
  })();

// ============================================================================
// 类型定义
// ============================================================================

interface MemoryRecord {
  content: string;
  tags: string[];
  source: "manual" | "chat" | "task_result" | "daily_log" | "system";
  createdAt: number;
  contentHash: string;
}

interface ImportReport {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
  importedFiles: string[];
  skippedFiles: string[];
}

interface CliArgs {
  memories: boolean;
  tasks: boolean;
  all: boolean;
  dryRun: boolean;
  help: boolean;
}

// ============================================================================
// CLI 参数解析
// ============================================================================

function parseArgs(): CliArgs {
  const args: CliArgs = {
    memories: false,
    tasks: false,
    all: false,
    dryRun: false,
    help: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === "--memories") args.memories = true;
    else if (arg === "--tasks") args.tasks = true;
    else if (arg === "--all") args.all = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }

  // 默认行为：如果未指定任何选项，显示帮助
  if (!args.memories && !args.tasks && !args.all && !args.help) {
    args.help = true;
  }

  // --all 覆盖其他选项
  if (args.all) {
    args.memories = true;
    args.tasks = true;
  }

  return args;
}

function showHelp() {
  console.log(`
📦 OpenClaw 数据导入工具

用法:
  cd mission-control-next && npx tsx ../scripts/import-data.ts [选项]

选项:
  --memories    仅导入记忆文件 (memory/*.md 和 MEMORY.md)
  --tasks       仅导入任务（待实现）
  --all         导入所有数据（记忆 + 任务）
  --dry-run     预览模式，不实际导入到 Convex
  --help, -h    显示此帮助信息

示例:
  # 预览导入结果
  npx tsx ../scripts/import-data.ts --memories --dry-run

  # 实际导入记忆
  npx tsx ../scripts/import-data.ts --memories

  # 导入所有数据
  npx tsx ../scripts/import-data.ts --all

特性:
  ✓ 幂等性：通过 content hash 避免重复导入
  ✓ 详细报告：显示导入进度和统计信息
  ✓ 错误处理：失败时继续处理其他记录
`);
}

// ============================================================================
// 工具函数
// ============================================================================

function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function extractTagsFromFilename(filename: string): string[] {
  const tags: string[] = [];
  const basename = path.basename(filename, ".md");

  // 从文件名提取标签
  if (basename.includes("daily-audit")) tags.push("daily-audit");
  else if (basename.includes("weekly-audit")) tags.push("weekly-audit");
  else if (basename.includes("capability-verification")) tags.push("capability-verification");
  else if (basename.includes("ERROR-LOG")) tags.push("error", "system");
  else if (basename.includes("LEARNING_LOG")) tags.push("learning", "reflection");
  else if (basename.includes("superego-check")) tags.push("superego", "audit");
  else if (basename.includes("github")) tags.push("github", "integration");
  else if (basename.includes("xiaohongshu")) tags.push("xiaohongshu", "social");
  else if (basename.includes("heartbeat")) tags.push("heartbeat", "system");
  else if (basename.includes("verification")) tags.push("verification", "test");
  else if (basename.includes("webhook")) tags.push("webhook", "integration");
  else if (basename.includes("upgrade")) tags.push("upgrade", "system");
  else if (/^\d{4}-\d{2}-\d{2}$/.test(basename)) {
    // 日常日志文件
    tags.push("daily-log");
    // 从日期提取年份月份标签
    const [year, month] = basename.split("-");
    tags.push(`${year}`, `${year}-${month}`);
  }

  return tags.length > 0 ? tags : ["general"];
}

function determineSource(filename: string): MemoryRecord["source"] {
  const basename = path.basename(filename);

  if (basename.includes("ERROR-LOG")) return "system";
  if (basename.includes("superego-check")) return "system";
  if (basename.includes("capability-verification")) return "task_result";
  if (basename.includes("daily-audit") || basename.includes("weekly-audit")) return "system";
  if (basename.includes("LEARNING_LOG")) return "manual";
  if (/^\d{4}-\d{2}-\d{2}(-\d{4})?\.md$/.test(basename)) return "chat";
  if (basename === "MEMORY.md") return "manual";

  return "chat";
}

function getFileTimestamp(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtimeMs;
  } catch {
    return Date.now();
  }
}

// ============================================================================
// 记忆文件解析
// ============================================================================

function parseMemoryFile(filePath: string): MemoryRecord | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const filename = path.basename(filePath);

    // 跳过空文件
    if (!content.trim()) {
      return null;
    }

    // 提取元数据
    const tags = extractTagsFromFilename(filename);
    const source = determineSource(filename);
    const createdAt = getFileTimestamp(filePath);
    const contentHash = computeContentHash(content);

    return {
      content: content.trim(),
      tags,
      source,
      createdAt,
      contentHash,
    };
  } catch (error) {
    console.error(`❌ 读取文件失败 ${filePath}:`, error);
    return null;
  }
}

function collectMemoryFiles(): string[] {
  const files: string[] = [];

  // 收集 memory/*.md 文件
  if (fs.existsSync(MEMORY_DIR)) {
    const entries = fs.readdirSync(MEMORY_DIR);
    for (const entry of entries) {
      if (entry.endsWith(".md")) {
        const fullPath = path.join(MEMORY_DIR, entry);
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          files.push(fullPath);
        }
      }
    }
  }

  // 添加 MEMORY.md
  if (fs.existsSync(MEMORY_MD_PATH)) {
    files.push(MEMORY_MD_PATH);
  }

  return files.sort();
}

// ============================================================================
// Convex 客户端
// ============================================================================

class ConvexImporter {
  private client: ConvexClient;
  public importedHashes = new Set<string>();

  constructor(convexUrl: string) {
    this.client = new ConvexClient(convexUrl);
  }

  async checkExistingMemories(): Promise<Set<string>> {
    try {
      // 获取所有现有记忆的 hash（需要从 content 计算）
      // 注意：这里假设 Convex 端有 list 查询返回所有记忆
      const memories = await this.client.query(api.memories.list as any, {});
      const hashes = new Set<string>();
      
      for (const memory of memories as any[]) {
        if (memory.contentHash) {
          hashes.add(memory.contentHash);
        }
      }
      
      return hashes;
    } catch (error) {
      console.warn("⚠️  无法获取现有记忆列表，将导入所有记录:", error);
      return new Set();
    }
  }

  async importMemory(memory: MemoryRecord, dryRun: boolean = false): Promise<boolean> {
    // 检查是否已存在
    if (this.importedHashes.has(memory.contentHash)) {
      console.log(`⏭️  跳过（重复）: ${memory.contentHash.substring(0, 8)}...`);
      return false;
    }

    if (dryRun) {
      console.log(`📋 [预览] 将导入：${memory.contentHash.substring(0, 8)}... (${memory.tags.join(", ")})`);
      this.importedHashes.add(memory.contentHash);
      return true;
    }

    try {
      // 调用 Convex mutation 导入
      const result = await this.client.mutation(api.memories.add as any, {
        content: memory.content,
        tags: memory.tags,
        source: memory.source,
        createdAt: memory.createdAt,
        contentHash: memory.contentHash,
      });

      this.importedHashes.add(memory.contentHash);
      
      if ((result as any).skipped) {
        console.log(`⏭️  跳过（已存在）: ${memory.contentHash.substring(0, 8)}...`);
        return false;
      } else {
        console.log(`✅ 导入成功：${memory.contentHash.substring(0, 8)}...`);
        return true;
      }
    } catch (error) {
      console.error(`❌ 导入失败：${memory.contentHash.substring(0, 8)}...`, error);
      return false;
    }
  }

  async close() {
    // ConvexClient 不需要显式关闭
  }
}

// ============================================================================
// 导入执行
// ============================================================================

async function importMemories(dryRun: boolean = false): Promise<ImportReport> {
  const report: ImportReport = {
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    importedFiles: [],
    skippedFiles: [],
  };

  console.log("\n📂 收集记忆文件...");
  const files = collectMemoryFiles();
  console.log(`   找到 ${files.length} 个文件`);

  if (files.length === 0) {
    console.log("⚠️  未找到记忆文件");
    return report;
  }

  console.log("\n🔌 连接 Convex...");
  const importer = new ConvexImporter(CONVEX_URL);

  if (!dryRun) {
    console.log("   检查现有记忆...");
    importer.importedHashes = await importer.checkExistingMemories();
    console.log(`   发现 ${importer.importedHashes.size} 条现有记录`);
  }

  console.log("\n📥 开始导入...\n");

  for (const file of files) {
    report.total++;
    const relativePath = path.relative(WORKSPACE_ROOT, file);

    const memory = parseMemoryFile(file);
    if (!memory) {
      report.skipped++;
      report.skippedFiles.push(relativePath);
      console.log(`⏭️  跳过（空文件）: ${relativePath}`);
      continue;
    }

    const success = await importer.importMemory(memory, dryRun);
    if (success) {
      report.imported++;
      report.importedFiles.push(relativePath);
    } else {
      report.skipped++;
      report.skippedFiles.push(relativePath);
    }
  }

  await importer.close();

  return report;
}

async function importTasks(dryRun: boolean = false): Promise<ImportReport> {
  console.log("\n⚠️  任务导入功能尚未实现");
  console.log("   待实现：从 GitHub Issues / 本地任务文件导入到 Convex tasks 表");
  
  return {
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    importedFiles: [],
    skippedFiles: [],
  };
}

function printReport(report: ImportReport, dryRun: boolean = false) {
  console.log("\n" + "=".repeat(60));
  console.log(`📊 导入报告 ${dryRun ? "(预览模式)" : ""}`);
  console.log("=".repeat(60));
  console.log(`总计：   ${report.total} 个文件`);
  console.log(`导入：   ${report.imported} ✅`);
  console.log(`跳过：   ${report.skipped} ⏭️`);
  console.log(`失败：   ${report.failed} ❌`);
  console.log("=".repeat(60));

  if (report.errors.length > 0) {
    console.log("\n❌ 错误详情:");
    for (const { file, error } of report.errors) {
      console.log(`   ${file}: ${error}`);
    }
  }

  if (report.importedFiles.length > 0 && !dryRun) {
    console.log("\n✅ 成功导入的文件:");
    for (const file of report.importedFiles.slice(0, 10)) {
      console.log(`   ${file}`);
    }
    if (report.importedFiles.length > 10) {
      console.log(`   ... 还有 ${report.importedFiles.length - 10} 个文件`);
    }
  }

  if (dryRun && report.importedFiles.length > 0) {
    console.log("\n💡 提示：以上文件将在实际导入时处理");
    console.log("   移除 --dry-run 参数执行实际导入");
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log("🚀 OpenClaw 数据导入工具");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   预览模式：${args.dryRun ? "是" : "否"}`);

  const startTime = Date.now();

  try {
    if (args.memories) {
      const report = await importMemories(args.dryRun);
      printReport(report, args.dryRun);
    }

    if (args.tasks) {
      const report = await importTasks(args.dryRun);
      printReport(report, args.dryRun);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  总耗时：${duration}s`);
    console.log("\n✨ 导入完成！\n");
  } catch (error) {
    console.error("\n❌ 导入过程中发生错误:", error);
    process.exit(1);
  }
}

// 执行
main();
