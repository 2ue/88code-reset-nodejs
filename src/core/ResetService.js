/**
 * 重置服务
 * 核心业务逻辑：订阅过滤和重置执行
 */

import Logger from '../utils/Logger.js';
import TimeUtils from '../utils/TimeUtils.js';
import {
    SUBSCRIPTION_TYPES,
    RESET_TYPES,
    RESET_STATUS,
} from '../constants.js';

export class ResetService {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.delayedTimers = new Map(); // 存储延迟定时器
    }

    /**
     * 执行重置
     * @param {string} resetType - 重置类型（FIRST/SECOND）
     * @returns {Promise<Object>} 重置结果
     */
    async executeReset(resetType) {
        Logger.info(`========== 开始执行${resetType === RESET_TYPES.FIRST ? '首次' : '二次'}重置 ==========`);

        const result = {
            resetType,
            startTime: Date.now(),
            endTime: 0,
            totalDuration: 0,
            totalSubscriptions: 0,
            eligible: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            details: [],
        };

        try {
            // 1. 获取订阅列表
            const subscriptions = await this.apiClient.getSubscriptions();
            result.totalSubscriptions = subscriptions.length;

            Logger.info(`获取到 ${subscriptions.length} 个订阅`);

            // 2. 过滤符合条件的订阅
            const eligibleSubscriptions = subscriptions.filter(sub =>
                this.isEligible(sub, resetType)
            );

            result.eligible = eligibleSubscriptions.length;

            Logger.info(`符合条件的订阅: ${eligibleSubscriptions.length} 个`);

            if (eligibleSubscriptions.length === 0) {
                Logger.warn('没有符合条件的订阅，跳过重置');
                result.endTime = Date.now();
                result.totalDuration = result.endTime - result.startTime;
                return result;
            }

            // 3. 逐个处理订阅（串行，避免触发限流）
            for (const subscription of eligibleSubscriptions) {
                // 如果是第二次重置，尝试处理延迟重置
                if (resetType === RESET_TYPES.SECOND) {
                    const detail = await this.processSubscriptionWithDelay(subscription, resetType);
                    result.details.push(detail);

                    if (detail.status === RESET_STATUS.SUCCESS) {
                        result.success++;
                    } else if (detail.status === RESET_STATUS.SKIPPED) {
                        result.skipped++;
                    } else {
                        result.failed++;
                    }
                } else {
                    // 首次重置，正常处理
                    const detail = await this.processSubscription(subscription, resetType);
                    result.details.push(detail);

                    if (detail.status === RESET_STATUS.SUCCESS) {
                        result.success++;
                    } else if (detail.status === RESET_STATUS.SKIPPED) {
                        result.skipped++;
                    } else {
                        result.failed++;
                    }
                }

                // 每次重置后延迟1秒
                if (subscription !== eligibleSubscriptions[eligibleSubscriptions.length - 1]) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 4. 汇总结果
            result.endTime = Date.now();
            result.totalDuration = result.endTime - result.startTime;

            Logger.info(`========== 重置完成 ==========`);
            Logger.info(`总耗时: ${(result.totalDuration / 1000).toFixed(2)}秒`);
            Logger.info(`成功: ${result.success}, 失败: ${result.failed}, 跳过: ${result.skipped}`);

            return result;

        } catch (error) {
            Logger.error('重置过程发生错误', error);
            result.endTime = Date.now();
            result.totalDuration = result.endTime - result.startTime;
            result.error = error.message;
            return result;
        }
    }

    /**
     * 判断订阅是否符合重置条件
     * @param {Object} subscription - 订阅对象
     * @param {string} resetType - 重置类型
     * @returns {boolean}
     */
    isEligible(subscription, resetType) {
        const subId = subscription.id;

        // P0: PAYGO保护（最高优先级）
        if (this.isPAYGO(subscription)) {
            Logger.warn(`[订阅${subId}] 🚨 PAYGO订阅，已跳过`);
            return false;
        }

        // P1: 订阅类型检查
        if (subscription.subscriptionPlan.planType !== SUBSCRIPTION_TYPES.MONTHLY) {
            Logger.debug(`[订阅${subId}] 非MONTHLY订阅，已跳过`);
            return false;
        }

        // P1: 激活状态检查
        if (!subscription.isActive) {
            Logger.debug(`[订阅${subId}] 订阅未激活，已跳过`);
            return false;
        }

        // P2: 冷却检查
        const cooldown = TimeUtils.checkCooldown(subscription.lastCreditReset);
        if (!cooldown.passed) {
            Logger.warn(`[订阅${subId}] 冷却中，还需等待 ${cooldown.formatted}`);
            return false;
        }

        // P3: 重置次数检查（关键策略）
        if (resetType === RESET_TYPES.FIRST) {
            // 首次重置：只有resetTimes==2时才重置
            if (subscription.resetTimes < 2) {
                Logger.info(
                    `[订阅${subId}] 首次重置跳过，resetTimes=${subscription.resetTimes} (用户已手动重置)`
                );
                return false;
            }
        } else if (resetType === RESET_TYPES.SECOND) {
            // 二次重置：resetTimes>=1就重置
            if (subscription.resetTimes < 1) {
                Logger.info(
                    `[订阅${subId}] 二次重置跳过，resetTimes=${subscription.resetTimes} (次数已用完)`
                );
                return false;
            }
        }

        return true;
    }

    /**
     * 处理单个订阅（带延迟重置支持）
     * 仅用于第二次重置（23:56）
     * @param {Object} subscription - 订阅对象
     * @param {string} resetType - 重置类型
     * @returns {Promise<Object>} 处理结果
     */
    async processSubscriptionWithDelay(subscription, resetType) {
        const subId = subscription.id;
        const cooldown = TimeUtils.checkCooldown(subscription.lastCreditReset);

        // 如果冷却已过，直接重置
        if (cooldown.passed) {
            return await this.processSubscription(subscription, resetType);
        }

        // 还在冷却中，检查是否能在今天完成
        const cooldownEndTime = TimeUtils.getCooldownEndTime(subscription.lastCreditReset);
        const canFinishToday = TimeUtils.isBeforeTodayEnd(cooldownEndTime);

        if (!canFinishToday) {
            // 冷却结束时间超过23:59:49，无法在今天完成
            Logger.warn(
                `[订阅${subId}] 冷却中，今天无法完成第二次重置 ` +
                `(冷却结束时间: ${TimeUtils.formatDateTime(cooldownEndTime)}, ` +
                `还需等待: ${cooldown.formatted})`
            );

            return {
                subscriptionId: subId,
                subscriptionName: subscription.subscriptionPlanName,
                status: RESET_STATUS.SKIPPED,
                message: '冷却中，今天无法完成重置',
                cooldownEndTime: TimeUtils.formatDateTime(cooldownEndTime),
            };
        }

        // 可以在今天完成，创建延迟定时器
        const now = Date.now();
        const delayMs = cooldownEndTime - now;

        Logger.info(
            `[订阅${subId}] 冷却中，将在 ${TimeUtils.formatDateTime(cooldownEndTime)} ` +
            `执行延迟重置（${Math.ceil(delayMs / 1000)}秒后）`
        );

        // 创建延迟定时器
        return new Promise((resolve) => {
            const timerId = setTimeout(async () => {
                Logger.info(`[订阅${subId}] 开始执行延迟重置`);

                try {
                    const result = await this.processSubscription(subscription, resetType);
                    this.delayedTimers.delete(subId);
                    resolve(result);
                } catch (error) {
                    Logger.error(`[订阅${subId}] 延迟重置失败`, error);
                    this.delayedTimers.delete(subId);
                    resolve({
                        subscriptionId: subId,
                        subscriptionName: subscription.subscriptionPlanName,
                        status: RESET_STATUS.FAILED,
                        message: '延迟重置失败',
                        error: error.message,
                    });
                }
            }, delayMs);

            // 保存定时器引用
            this.delayedTimers.set(subId, timerId);
        });
    }

    /**
     * 处理单个订阅
     * @param {Object} subscription - 订阅对象
     * @param {string} resetType - 重置类型
     * @returns {Promise<Object>} 处理结果
     */
    async processSubscription(subscription, resetType) {
        const subId = subscription.id;
        const creditPercent = (subscription.currentCredits / subscription.subscriptionPlan.creditLimit) * 100;

        const detail = {
            subscriptionId: subId,
            subscriptionName: subscription.subscriptionPlanName,
            status: RESET_STATUS.SUCCESS,
            beforeCredits: subscription.currentCredits,
            afterCredits: null,
            beforeResetTimes: subscription.resetTimes,
            afterResetTimes: null,
            message: '',
        };

        try {
            // 无脑重置策略（无论余额多少）
            if (resetType === RESET_TYPES.FIRST) {
                Logger.info(
                    `[订阅${subId}] 执行首次重置 (重置次数满 2/2，当前余额 ${creditPercent.toFixed(1)}%)`
                );
            } else {
                Logger.info(
                    `[订阅${subId}] 执行二次重置 (用完剩余次数 ${subscription.resetTimes}/2，当前余额 ${creditPercent.toFixed(1)}%)`
                );
            }

            // 执行重置
            const resetResult = await this.apiClient.resetCredits(subId);

            // 等待3秒让API更新
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 重新获取订阅信息验证
            const updatedSubscriptions = await this.apiClient.getSubscriptions();
            const updated = updatedSubscriptions.find(s => s.id === subId);

            if (updated) {
                detail.afterCredits = updated.currentCredits;
                detail.afterResetTimes = updated.resetTimes;

                Logger.success(
                    `[订阅${subId}] 重置成功: ` +
                    `${detail.beforeCredits.toFixed(2)} → ${detail.afterCredits.toFixed(2)} credits, ` +
                    `resetTimes ${detail.beforeResetTimes} → ${detail.afterResetTimes}`
                );

                detail.message = '重置成功';
            } else {
                detail.message = '重置成功（未能验证结果）';
            }

        } catch (error) {
            Logger.error(`[订阅${subId}] 重置失败`, error);
            detail.status = RESET_STATUS.FAILED;
            detail.message = error.message;
            detail.error = error.message;
        }

        return detail;
    }

    /**
     * 判断是否为PAYGO订阅
     * @param {Object} subscription - 订阅对象
     * @returns {boolean}
     */
    isPAYGO(subscription) {
        const { subscriptionPlanName, subscriptionPlan } = subscription;

        return (
            subscriptionPlanName === SUBSCRIPTION_TYPES.PAYGO ||
            subscriptionPlan.subscriptionName === SUBSCRIPTION_TYPES.PAYGO ||
            subscriptionPlan.planType === SUBSCRIPTION_TYPES.PAYGO ||
            subscriptionPlan.planType === SUBSCRIPTION_TYPES.PAY_PER_USE
        );
    }

    /**
     * 清理所有延迟定时器
     * 用��程序关闭时清理
     */
    clearDelayedTimers() {
        for (const [subId, timerId] of this.delayedTimers.entries()) {
            clearTimeout(timerId);
            Logger.debug(`已清理订阅${subId}的延迟定时器`);
        }
        this.delayedTimers.clear();
    }
}

export default ResetService;
