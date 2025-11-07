#!/usr/bin/env node
/**
 * E2E 测试运行器
 *
 * 用法:
 *   pnpm run test:e2e              # 运行所有 E2E 测试（默认配置）
 *   pnpm run test:e2e full         # 完整流程测试
 *   pnpm run test:e2e first-only   # 仅 FIRST checkpoint
 *   pnpm run test:e2e second-only  # 仅 SECOND checkpoint
 *   pnpm run test:e2e delayed      # 延迟重置测试
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// 解析命令行参数
const scenario = process.argv[2] || 'full';
const validScenarios = ['full', 'first-only', 'second-only', 'delayed'];

if (!validScenarios.includes(scenario)) {
  console.error(`❌ 无效的场景: ${scenario}`);
  console.error(`可用场景: ${validScenarios.join(', ')}`);
  process.exit(1);
}

const envFile = join(__dirname, `.env.e2e.${scenario}`);

// 检查环境文件是否存在
if (!fs.existsSync(envFile)) {
  console.error(`❌ 环境配置文件不存在: ${envFile}`);
  process.exit(1);
}

console.log(`\n🧪 E2E 测试运行器`);
console.log(`📋 场景: ${scenario}`);
console.log(`📄 配置文件: .env.e2e.${scenario}`);
console.log(`\n${'='.repeat(60)}\n`);

// 复制环境配置
const targetEnv = join(projectRoot, '.env');
fs.copyFileSync(envFile, targetEnv);
console.log(`✅ 已加载环境配置: ${scenario}\n`);

// 运行测试
const testFile = join(__dirname, 'full-flow.test.js');
const nodeProcess = spawn('node', ['--test', testFile], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: `e2e-test-${scenario}` }
});

nodeProcess.on('close', (code) => {
  console.log(`\n${'='.repeat(60)}`);
  if (code === 0) {
    console.log(`\n✅ E2E 测试通过 (场景: ${scenario})\n`);
  } else {
    console.log(`\n❌ E2E 测试失败 (场景: ${scenario})\n`);
  }
  process.exit(code);
});

nodeProcess.on('error', (err) => {
  console.error(`\n❌ 测试运行出错:`, err);
  process.exit(1);
});
