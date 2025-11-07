#!/usr/bin/env node

/**
 * 测试运行器 - 运行所有测试文件
 *
 * 使用 Node.js 内置测试框架（node:test）
 * 不需要额外依赖
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 88code Reset Service - 测试套件\n');

// 定义所有测试文件
const testFiles = [
  './tests/unit/ResetService.test.js',
  './tests/unit/TimeUtils.test.js',
  './tests/unit/DynamicTimerManager.test.js',
  './tests/integration/reset-flow.test.js',
];

console.log('运行测试文件：');
testFiles.forEach((file) => console.log(`  - ${file}`));
console.log('');

// 使用 node --test 运行所有测试
const proc = spawn('node', ['--test', ...testFiles], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

proc.on('close', (code) => {
  process.exit(code);
});
