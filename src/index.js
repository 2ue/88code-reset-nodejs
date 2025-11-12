/**
 * 入口文件
 * 初始化并启动应用
 */

import Logger from './utils/Logger.js';
import APIClient from './core/APIClient.js';
import ResetService from './core/ResetService.js';
import Scheduler from './core/Scheduler.js';
import FileStorage from './storage/FileStorage.js';
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
        const fileStorage = new FileStorage();
        const apiClients = config.apiKeys.map(apiKey => new APIClient(apiKey));
        const resetServices = apiClients.map(client => new ResetService(client));

        // 如果有多个账号，串行处理
        const resetService = {
            // 初始化所有服务
            async initialize() {
                for (const service of resetServices) {
                    await service.initialize();
                }
            },

            async executeReset(resetType) {
                const results = [];
                for (const service of resetServices) {
                    const result = await service.executeReset(resetType);
                    results.push(result);
                }
                return results;
            },

            // 清理所有延迟定时器
            clearDelayedTimers() {
                for (const service of resetServices) {
                    service.clearDelayedTimers();
                }
            }
        };

        // 保存引用以便清理
        resetServiceWrapper = resetService;

        // 初始化通知管理器
        await resetService.initialize();

        // 启动调度器
        scheduler = new Scheduler(resetService, fileStorage);
        await scheduler.start();

        Logger.success('服务启动成功！');

        // 发送启动成功通知（如果配置了通知器）
        await sendStartupNotification(resetServices);

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

/**
 * 发送启动成功通知
 * @param {Array} resetServices - 重置服务数组
 */
async function sendStartupNotification(resetServices) {
    try {
        // 检查是否有任何服务配置了通知器
        const hasNotifier = resetServices.some(service =>
            service.notifierManager && service.notifierManager.isEnabled()
        );

        if (!hasNotifier) {
            Logger.debug('未配置通知器，跳过启动通知');
            return;
        }

        Logger.info('发送启动成功通知...');

        // 获取当前时区时间
        const now = new Date();
        const configTime = now.toLocaleString('zh-CN', {
            timeZone: config.timezone,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // 收集所有订阅信息
        const allSubscriptions = [];
        for (const service of resetServices) {
            try {
                const subs = await service.apiClient.getSubscriptions();
                allSubscriptions.push(...subs);
            } catch (error) {
                Logger.warn('获取订阅信息失败', error.message);
            }
        }

        // 构造通知数据
        const notificationData = {
            resetType: 'STARTUP',
            startTime: now.getTime(),
            endTime: now.getTime(),
            totalDuration: 0,
            totalSubscriptions: allSubscriptions.length,
            eligible: allSubscriptions.length,
            success: allSubscriptions.length,
            failed: 0,
            skipped: 0,
            scheduled: 0,
            details: allSubscriptions.map(sub => {
                const isPAYGO = sub.subscriptionPlanName === 'PAYGO' ||
                               sub.subscriptionPlan?.subscriptionName === 'PAYGO' ||
                               sub.subscriptionPlan?.planType === 'PAYGO' ||
                               sub.subscriptionPlan?.planType === 'PAY_PER_USE';

                let message = `余额: ${sub.currentCredits.toFixed(2)}`;
                if (!isPAYGO) {
                    message += `, 剩余次数: ${sub.resetTimes}`;
                }

                return {
                    subscriptionId: sub.id,
                    subscriptionName: sub.subscriptionPlanName,
                    status: 'ACTIVE',
                    message,
                    beforeCredits: sub.currentCredits,
                    afterCredits: sub.currentCredits,
                };
            })
        };

        // 只发送一次通知（使用第一个配置了通知器的服务）
        const notifierService = resetServices.find(service =>
            service.notifierManager && service.notifierManager.isEnabled()
        );

        if (notifierService) {
            await notifierService.notifierManager.notify(notificationData);
            Logger.success('启动通知发送成功');
        }
    } catch (error) {
        Logger.error('发送启动通知失败', error);
        // 不阻塞启动流程
    }
}

// 优雅关闭
let resetServiceWrapper = null; // 保存resetService引用

process.on('SIGTERM', async () => {
    Logger.info('收到SIGTERM信号，开始优雅关闭...');

    if (scheduler) {
        scheduler.stop();
    }

    // 清理所有延迟定时器
    if (resetServiceWrapper) {
        resetServiceWrapper.clearDelayedTimers();
    }

    await Logger.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    Logger.info('收到SIGINT信号，开始优雅关闭...');

    if (scheduler) {
        scheduler.stop();
    }

    // 清理所有延迟定时器
    if (resetServiceWrapper) {
        resetServiceWrapper.clearDelayedTimers();
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
