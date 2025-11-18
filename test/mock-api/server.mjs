#!/usr/bin/env node
/**
 * 88code Mock API 服务器
 * 用于测试，模拟88code API的响应
 *
 * 使用方法:
 *   node test/mock-api/server.mjs [port]
 *
 * 测试数据文件:
 *   test/mock-api/test-data.json - 可以随时修改此文件来测试不同场景
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.MOCK_API_PORT || process.argv[2] || 3888;
const DATA_FILE = path.join(__dirname, 'test-data.json');

// 加载测试数据
function loadTestData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ 无法加载测试数据:', error.message);
        console.error(`   请确保文件存在: ${DATA_FILE}`);
        return [];
    }
}

// 监听文件变化，支持热重载
let mockSubscriptions = loadTestData();
fs.watch(DATA_FILE, (eventType) => {
    if (eventType === 'change') {
        console.log('📝 检测到测试数据变化，重新加载...');
        mockSubscriptions = loadTestData();
        console.log(`✅ 已加载 ${mockSubscriptions.length} 个订阅`);
    }
});

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const timestamp = new Date().toISOString();

    // 获取订阅列表
    if (req.method === 'POST' && req.url === '/api/subscription') {
        console.log(`[${timestamp}] GET /api/subscription`);
        console.log(`  → 返回 ${mockSubscriptions.length} 个订阅`);

        res.writeHead(200);
        res.end(JSON.stringify(mockSubscriptions));
        return;
    }

    // 重置额度
    const resetMatch = req.url.match(/^\/api\/reset-credits\/(\d+)$/);
    if (req.method === 'POST' && resetMatch) {
        const subscriptionId = resetMatch[1];

        console.log(`[${timestamp}] POST /api/reset-credits/${subscriptionId}`);

        // 查找订阅
        const subscription = mockSubscriptions.find(s => String(s.id) === subscriptionId);

        if (!subscription) {
            console.log(`  ❌ 订阅不存在: ${subscriptionId}`);
            res.writeHead(404);
            res.end(JSON.stringify({
                success: false,
                message: '订阅不存在'
            }));
            return;
        }

        // Mock场景：永远返回成功，但数据不变化
        // 这模拟了真实场景中API返回成功但resetTimes已经用完的情况
        console.log(`  ✅ 返回成功（数据不变化）`);
        console.log(`     订阅: ${subscription.subscriptionPlanName}(${subscription.id})`);
        console.log(`     resetTimes: ${subscription.resetTimes}`);

        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            message: '重置成功',
            data: {
                subscriptionId: String(subscriptionId)
            }
        }));
        return;
    }

    // 404
    console.log(`[${timestamp}] ${req.method} ${req.url} - 404`);
    res.writeHead(404);
    res.end(JSON.stringify({
        success: false,
        message: 'Not Found'
    }));
});

server.listen(PORT, () => {
    console.log('='.repeat(80));
    console.log('🚀 88code Mock API 服务器已启动');
    console.log('='.repeat(80));
    console.log(`📡 监听地址: http://localhost:${PORT}`);
    console.log(`📁 数据文件: ${DATA_FILE}`);
    console.log(`📊 订阅数量: ${mockSubscriptions.length}`);
    console.log('');
    console.log('💡 提示:');
    console.log('   - 修改 test-data.json 文件会自动重新加载');
    console.log('   - 按 Ctrl+C 停止服务器');
    console.log('='.repeat(80));
    console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n\n🛑 正在关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 正在关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});
