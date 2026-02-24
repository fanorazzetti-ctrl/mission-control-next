/**
 * Verify Task Completion
 * 
 * This script:
 * 1. Executes preset test cases
 * 2. Verifies output files exist
 * 3. Calls verifyTask API with results
 * 
 * Usage:
 *   npx tsx scripts/verify-task.ts --taskId <task-id> --test-cases <test-case-1,test-case-2>
 *   npx tsx scripts/verify-task.ts --taskId <task-id> --output-files <file1,file2>
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import * as path from "path";

// Configuration
const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  console.warn("CONVEX_URL not set, running in mock mode");
}
const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;

interface VerifyOptions {
  taskId: string;
  testCases?: string[];
  outputFiles?: string[];
  customScript?: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

/**
 * Check if output files exist
 */
function verifyOutputFiles(files: string[]): TestResult[] {
  const results: TestResult[] = [];
  
  for (const file of files) {
    const fullPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    const exists = existsSync(fullPath);
    
    results.push({
      name: `File exists: ${file}`,
      passed: exists,
      message: exists ? `✅ File found: ${fullPath}` : `❌ File not found: ${fullPath}`,
    });
    
    if (exists) {
      try {
        const stats = require("fs").statSync(fullPath);
        results.push({
          name: `File size: ${file}`,
          passed: stats.size > 0,
          message: `📄 Size: ${(stats.size / 1024).toFixed(2)} KB`,
        });
      } catch (error) {
        results.push({
          name: `File readable: ${file}`,
          passed: false,
          message: `❌ Cannot read file: ${error}`,
        });
      }
    }
  }
  
  return results;
}

/**
 * Execute test cases (simple shell commands)
 */
function executeTestCases(testCases: string[]): TestResult[] {
  const results: TestResult[] = [];
  
  for (const testCase of testCases) {
    try {
      const output = execSync(testCase, { encoding: "utf-8", stdio: "pipe" });
      results.push({
        name: `Test: ${testCase}`,
        passed: true,
        message: `✅ Passed\nOutput: ${output.slice(0, 200)}`,
      });
    } catch (error: any) {
      results.push({
        name: `Test: ${testCase}`,
        passed: false,
        message: `❌ Failed\nError: ${error.message || error}`,
      });
    }
  }
  
  return results;
}

/**
 * Run custom verification script
 */
function runCustomScript(scriptPath: string): TestResult[] {
  const results: TestResult[] = [];
  
  try {
    const fullPath = path.isAbsolute(scriptPath) ? scriptPath : path.join(process.cwd(), scriptPath);
    
    if (!existsSync(fullPath)) {
      return [{
        name: `Custom script: ${scriptPath}`,
        passed: false,
        message: `❌ Script not found: ${fullPath}`,
      }];
    }
    
    const output = execSync(`node ${fullPath}`, { encoding: "utf-8", stdio: "pipe" });
    
    // Try to parse JSON output
    try {
      const parsed = JSON.parse(output);
      if (parsed.success) {
        results.push({
          name: `Custom script: ${scriptPath}`,
          passed: true,
          message: `✅ ${parsed.message || "Success"}`,
        });
      } else {
        results.push({
          name: `Custom script: ${scriptPath}`,
          passed: false,
          message: `❌ ${parsed.error || "Failed"}`,
        });
      }
    } catch {
      // Non-JSON output
      results.push({
        name: `Custom script: ${scriptPath}`,
        passed: true,
        message: `✅ ${output.slice(0, 200)}`,
      });
    }
  } catch (error: any) {
    results.push({
      name: `Custom script: ${scriptPath}`,
      passed: false,
      message: `❌ Script error: ${error.message || error}`,
    });
  }
  
  return results;
}

/**
 * Verify task completion
 */
async function verifyTask(options: VerifyOptions): Promise<{ success: boolean; passed: boolean; results: TestResult[] }> {
  const allResults: TestResult[] = [];
  
  console.log(`🔍 Verifying task ${options.taskId}...\n`);
  
  // Run test cases
  if (options.testCases && options.testCases.length > 0) {
    console.log("🧪 Running test cases...");
    const testResults = executeTestCases(options.testCases);
    allResults.push(...testResults);
    testResults.forEach(r => console.log(`  ${r.message}`));
    console.log();
  }
  
  // Verify output files
  if (options.outputFiles && options.outputFiles.length > 0) {
    console.log("📁 Verifying output files...");
    const fileResults = verifyOutputFiles(options.outputFiles);
    allResults.push(...fileResults);
    fileResults.forEach(r => console.log(`  ${r.message}`));
    console.log();
  }
  
  // Run custom script
  if (options.customScript) {
    console.log("🔧 Running custom verification script...");
    const scriptResults = runCustomScript(options.customScript);
    allResults.push(...scriptResults);
    scriptResults.forEach(r => console.log(`  ${r.message}`));
    console.log();
  }
  
  // Determine overall pass/fail
  const passed = allResults.every(r => r.passed);
  const failedCount = allResults.filter(r => !r.passed).length;
  
  // Generate verification report
  const report = allResults.map(r => `${r.passed ? "✅" : "❌"} ${r.name}: ${r.message}`).join("\n");
  const summary = `Passed: ${allResults.length - failedCount}/${allResults.length}`;
  
  console.log(`\n📊 Verification Summary: ${summary}`);
  console.log(`Overall: ${passed ? "✅ PASSED" : "❌ FAILED"}\n`);
  
  // Call Convex API if available
  if (convex) {
    try {
      const result = await convex.mutation(api.tasks.verifyTask, {
        taskId: options.taskId as any,
        verificationResult: `${summary}\n\n${report}`,
        passed: passed,
      });
      
      console.log(`📡 Convex API response:`, result);
      
      if (!result.passed && result.attempts >= 3) {
        console.warn("⚠️  Task marked for human intervention after 3 failed attempts");
      }
    } catch (error) {
      console.error("❌ Error calling Convex API:", error);
      return { success: false, passed: false, results: allResults };
    }
  } else {
    console.log("Mock mode - would call Convex API with:");
    console.log(`  taskId: ${options.taskId}`);
    console.log(`  passed: ${passed}`);
    console.log(`  result: ${summary}`);
  }
  
  return { success: true, passed, results: allResults };
}

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<VerifyOptions> {
  const args = process.argv.slice(2);
  const options: Partial<VerifyOptions> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--taskId" && args[i + 1]) {
      options.taskId = args[++i];
    } else if (arg === "--test-cases" && args[i + 1]) {
      options.testCases = args[++i].split(",");
    } else if (arg === "--output-files" && args[i + 1]) {
      options.outputFiles = args[++i].split(",");
    } else if (arg === "--custom-script" && args[i + 1]) {
      options.customScript = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Verify Task Completion

Usage:
  npx tsx scripts/verify-task.ts --taskId <task-id> [options]

Options:
  --taskId <id>           Convex task ID (required)
  --test-cases <cmds>     Comma-separated test commands to run
  --output-files <files>  Comma-separated file paths to verify
  --custom-script <path>  Custom verification script to execute
  --help, -h              Show this help message

Examples:
  npx tsx scripts/verify-task.ts --taskId "task123" --output-files "memory/report.md"
  npx tsx scripts/verify-task.ts --taskId "task123" --test-cases "npm test,git status"
  npx tsx scripts/verify-task.ts --taskId "task123" --custom-script "scripts/test-verification.sh"
`);
      process.exit(0);
    }
  }
  
  return options;
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs() as VerifyOptions;
  
  if (!options.taskId) {
    console.error("❌ Error: --taskId is required");
    console.error("Use --help for usage information");
    process.exit(1);
  }
  
  if (!options.testCases && !options.outputFiles && !options.customScript) {
    console.error("❌ Error: At least one verification method is required:");
    console.error("   --test-cases, --output-files, or --custom-script");
    console.error("Use --help for usage information");
    process.exit(1);
  }
  
  const result = await verifyTask(options);
  
  // Exit with error code if verification failed
  if (!result.passed) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { verifyTask, verifyOutputFiles, executeTestCases };
