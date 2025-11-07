/**
 * 入口文件
 * 初始化并启动应用
 */

import Logger from './utils/Logger.js';
import APIClient from './core/APIClient.js';
import ResetService from './core/ResetService.js';
import Scheduler from './core/Scheduler.js';
import config from './config.js';

let scheduler;

async function main() {
    try {
        // 获取服务器时间和时区信息
        const now = new Date();
        const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const systemOffset = -now.getTimezoneOffset() / 60;
        const systemOffsetStr = systemOffset >= 0 ? `+${systemOffset}` : `${systemOffset}`;

        // 配置的时区（用于定时任务）
        const configTimezone = config.timezone;
        const configTime = now.toLocaleString('zh-CN', {
            timeZone: configTimezone,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        Logger.info('========================================');
        Logger.info('  88code 自动重置工具 v1.0.0');
        Logger.info('========================================');
        Logger.info(`当前时区: ${configTimezone} (UTC${systemOffsetStr})`);
        Logger.info(`当前时间: ${configTime}`);
        Logger.info('========================================');

        // 测试模式
        if (process.argv.includes('--mode=test') || config.runTestOnStart) {
            Logger.info('运行测试模式...');
            await runTest();
            if (process.argv.includes('--mode=test')) {
                process.exit(0);
            }
        }

        // 初始化服务
        Logger.info('初始化服务...');
        const apiClients = config.apiKeys.map(apiKey => new APIClient(apiKey));
        const resetServices = apiClients.map(client => new ResetService(client));

        // 如果有多个账号，串行处理
        const resetService = {
            async executeReset(resetType) {
                const results = [];
                for (const service of resetServices) {
                    const result = await service.executeReset(resetType);
                    results.push(result);
                }
                return results;
            }
        };

        // 启动调度器
        scheduler = new Scheduler(resetService);
        await scheduler.start();

        Logger.success('服务启动成功！');

    } catch (error) {
        Logger.error('启动失败', error);
        process.exit(1);
    }
}

async function runTest() {
    Logger.info('========== API连接测试 ==========');

    for (const apiKey of config.apiKeys) {
        const client = new APIClient(apiKey);
        const success = await client.testConnection();

        if (success) {
            Logger.success(`API Key 测试成功: ${Logger.sanitizeAPIKey(apiKey)}`);

            // 获取订阅信息
            const subscriptions = await client.getSubscriptions();
            Logger.info(`  - 订阅数量: ${subscriptions.length}`);

            for (const sub of subscriptions) {
                const percent = (sub.currentCredits / sub.subscriptionPlan.creditLimit * 100).toFixed(1);
                Logger.info(`  - 订阅${sub.id}: ${sub.subscriptionPlanName}, 余额${percent}%, 剩余次数${sub.resetTimes}`);
            }
        } else {
            Logger.error(`❌ API Key 测试失败: ${Logger.sanitizeAPIKey(apiKey)}`);
        }
    }

    Logger.info('========== 测试完成 ==========');
}

// 优雅关闭
process.on('SIGTERM', async () => {
    Logger.info('收到SIGTERM信号，开始优雅关闭...');

    if (scheduler) {
        scheduler.stop();
    }

    await Logger.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    Logger.info('收到SIGINT信号，开始优雅关闭...');

    if (scheduler) {
        scheduler.stop();
    }

    await Logger.end();
    process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
    Logger.error('未捕获异常', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    Logger.error('未处理的Promise拒绝', reason);
    process.exit(1);
});

// 启动
main();
