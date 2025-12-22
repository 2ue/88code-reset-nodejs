#!/usr/bin/env node
/**
 * 低余额检测功能测试脚本（dry-run 模式，不执行重置）
 *
 * 使用方法：
 *   node test-low-balance.js
 *   node test-low-balance.js --threshold=5   # 自定义阈值测试
 */

import config from './src/config.js';
import APIClient from './src/core/APIClient.js';
import TimeUtils from './src/utils/TimeUtils.js';
import Logger from './src/utils/Logger.js';
import { SUBSCRIPTION_TYPES } from './src/constants.js';

// 解析命令行参数
const args = process.argv.slice(2);
const thresholdArg = args.find(a => a.startsWith('--threshold='));
const testThreshold = thresholdArg
    ? parseFloat(thresholdArg.split('=')[1])
    : config.lowBalanceThreshold;

console.log('========== 低余额检测测试（Dry-Run）==========\n');
console.log(`配置状态:`);
console.log(`  - 功能开关: ${config.enableLowBalanceReset ? '已启用' : '未启用'}`);
console.log(`  - 检测时间: ${config.lowBalanceCheckTime}`);
console.log(`  - 配置阈值: ${config.lowBalanceThreshold} 美元`);
console.log(`  - 测试阈值: ${testThreshold} 美元`);
console.log('');

async function testLowBalanceDetection() {
    for (const apiKey of config.apiKeys) {
        const maskedKey = Logger.sanitizeAPIKey(apiKey);
        console.log(`\n----- API Key: ${maskedKey} -----\n`);

        const client = new APIClient(apiKey);

        try {
            const subscriptions = await client.getSubscriptions();
            console.log(`获取到 ${subscriptions.length} 个订阅\n`);

            let eligibleCount = 0;

            for (const sub of subscriptions) {
                const name = sub.subscriptionPlanName || 'UNKNOWN';
                const subId = `[${name}订阅(${sub.id})]`;
                const balance = sub.currentCredits || 0;
                const resetTimes = sub.resetTimes || 0;
                const lastReset = sub.lastCreditReset;

                // 检查各项条件
                const checks = {
                    notPayPerUse: sub.subscriptionPlan?.planType !== SUBSCRIPTION_TYPES.PAY_PER_USE,
                    notPaygo: sub.subscriptionPlanName !== SUBSCRIPTION_TYPES.PAYGO,
                    isActive: sub.isActive === true,
                    hasResetTimes: resetTimes >= 1,
                    isLowBalance: balance < testThreshold,
                    cooldownPassed: TimeUtils.checkCooldown(lastReset).passed,
                };

                const cooldown = TimeUtils.checkCooldown(lastReset);
                const allBasicPassed = checks.notPayPerUse && checks.notPaygo &&
                                       checks.isActive && checks.hasResetTimes;

                // 输出检测结果
                console.log(`${subId}`);
                console.log(`  余额: ${balance.toFixed(2)} 美元 | 重置次数: ${resetTimes} | 冷却: ${cooldown.passed ? '已过' : cooldown.formatted}`);

                if (!checks.notPayPerUse) {
                    console.log(`  ❌ 跳过: PAY_PER_USE 订阅`);
                } else if (!checks.notPaygo) {
                    console.log(`  ❌ 跳过: PAYGO 订阅`);
                } else if (!checks.isActive) {
                    console.log(`  ❌ 跳过: 订阅未激活`);
                } else if (!checks.hasResetTimes) {
                    console.log(`  ❌ 跳过: 重置次数已用完`);
                } else if (!checks.isLowBalance) {
                    console.log(`  ⏭️  跳过: 余额 ${balance.toFixed(2)} >= 阈值 ${testThreshold}`);
                } else {
                    // 符合低余额条件
                    eligibleCount++;
                    if (checks.cooldownPassed) {
                        console.log(`  ✅ 符合条件: 余额低于阈值，冷却已过，可立即重置`);
                    } else {
                        const endTime = TimeUtils.getCooldownEndTime(lastReset);
                        console.log(`  ⏰ 符合条件: 余额低于阈值，将延迟到 ${TimeUtils.formatDateTime(endTime)} 执行`);
                    }
                }
                console.log('');
            }

            console.log(`----- 汇总 -----`);
            console.log(`符合低余额重置条件: ${eligibleCount} 个订阅`);

        } catch (error) {
            console.error(`获取订阅失败: ${error.message}`);
        }
    }
}

testLowBalanceDetection()
    .then(() => {
        console.log('\n========== 测试完成（未执行任何重置）==========');
        process.exit(0);
    })
    .catch(err => {
        console.error('测试失败:', err);
        process.exit(1);
    });
