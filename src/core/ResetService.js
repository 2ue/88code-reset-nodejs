/**
 * 重置服务
 * 核心业务逻辑：订阅过滤和重置执行
 */

import Logger from '../utils/Logger.js';
import TimeUtils from '../utils/TimeUtils.js';
import config from '../config.js';
import DynamicTimerManager from './DynamicTimerManager.js';
import NotifierManager from '../notifiers/NotifierManager.js';
import {
    SUBSCRIPTION_TYPES,
    RESET_TYPES,
    RESET_STATUS,
} from '../constants.js';

export class ResetService {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.timerManager = new DynamicTimerManager(); // 使用定时器管理器
        this.notifierManager = new NotifierManager(config); // 通知管理器
    }

    /**
     * 初始化服务
     */
    async initialize() {
        await this.notifierManager.initialize();
    }

    /**
     * 执行重置检查
     * @param {string} resetType - 检查点类型（FIRST/SECOND）
     * @returns {Promise<Object>} 重置结果
     */
    async executeReset(resetType) {
        Logger.info(`========== 开始执行${resetType === RESET_TYPES.FIRST ? '第一次检查点' : '第二次检查点'}重置 ==========`);

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
            scheduled: 0, // 新增：延迟重置调度计数
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
                    } else if (detail.status === RESET_STATUS.SCHEDULED) {
                        result.scheduled++; // 延迟重置调度
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

                // 每次重置后延迟（使用配置值）
                if (subscription !== eligibleSubscriptions[eligibleSubscriptions.length - 1]) {
                    await new Promise(resolve => setTimeout(resolve, config.requestIntervalMs));
                }
            }

            // 4. 汇总结果
            result.endTime = Date.now();
            result.totalDuration = result.endTime - result.startTime;

            Logger.info(`========== 重置完成 ==========`);
            Logger.info(`总耗时: ${(result.totalDuration / 1000).toFixed(2)}秒`);
            Logger.info(
                `成功: ${result.success}, 失败: ${result.failed}, 跳过: ${result.skipped}` +
                (result.scheduled > 0 ? `, 已调度延迟重置: ${result.scheduled}` : '')
            );

            // 发送通知
            await this.notifierManager.notify(result);

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
     * @param {string} resetType - 检查点类型（FIRST/SECOND）
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

        // P2: 冷却检查（第二次检查点允许延迟重置）
        const cooldown = TimeUtils.checkCooldown(subscription.lastCreditReset);
        if (!cooldown.passed) {
            if (resetType === RESET_TYPES.FIRST) {
                // 第一次检查点：冷却未过直接跳过
                Logger.warn(`[订阅${subId}] 冷却中，还需等待 ${cooldown.formatted}`);
                return false;
            }
            // 第二次检查点：冷却未过也允许通过，进入延迟重置逻辑
            Logger.info(`[订阅${subId}] 冷却中，将设置延迟重置（${cooldown.formatted}后）`);
            // 不 return false，继续执行后续检查
        }

        // P3: 重置次数检查（核心策略）
        if (resetType === RESET_TYPES.FIRST) {
            // 第一次检查点：只在重置次数=2时重置（保守策略，保留重置机会）
            if (subscription.resetTimes < 2) {
                Logger.info(
                    `[订阅${subId}] 第一次检查跳过，剩余次数${subscription.resetTimes}（保留给第二次检查）`
                );
                return false;
            }
        } else if (resetType === RESET_TYPES.SECOND) {
            // 第二次检查点：重置次数>=1就重置（兜底策略，最大化利用）
            if (subscription.resetTimes < 1) {
                Logger.info(
                    `[订阅${subId}] 第二次检查跳过，剩余次数${subscription.resetTimes}（次数已用完）`
                );
                return false;
            }
        }

        return true;
    }

    /**
     * 处理单个订阅（带延迟重置支持）
     * 用于第二次检查点，支持冷却未满时延迟重置
     * @param {Object} subscription - 订阅对象
     * @param {string} resetType - 检查点类型（通常为SECOND）
     * @returns {Promise<Object>} 处理结果（立即返回，不阻塞主流程）
     */
    async processSubscriptionWithDelay(subscription, resetType) {
        const subId = subscription.id;
        const cooldown = TimeUtils.checkCooldown(subscription.lastCreditReset);

        // 如果冷却已过，直接重置
        if (cooldown.passed) {
            return await this.processSubscription(subscription, resetType);
        }

        // 冷却未满，精确计算下次可重置时间（支持跨天）
        const cooldownEndTime = TimeUtils.getCooldownEndTime(subscription.lastCreditReset);
        const now = Date.now();
        const delayMs = Math.max(0, cooldownEndTime - now + 1000); // 额外等待1秒缓冲

        Logger.info(
            `[订阅${subId}] 冷却中，已调度延迟重置，将在 ${TimeUtils.formatDateTime(cooldownEndTime)} 执行 ` +
            `（${Math.ceil(delayMs / 1000)}秒后）`
        );

        // 创建后台延迟定时器（不阻塞主流程）
        const timerId = setTimeout(async () => {
            Logger.info(`[订阅${subId}] 开始执行延迟重置`);

            try {
                // 重新获取最新的订阅信息（避免使用过期数据）
                const latestSubscriptions = await this.apiClient.getSubscriptions();
                const latestSubscription = latestSubscriptions.find(s => s.id === subId);

                if (!latestSubscription) {
                    Logger.error(`[订阅${subId}] 订阅不存在，取消延迟重置`);
                    this.timerManager.clear(`delayed-reset-${subId}`);
                    return;
                }

                // 使用最新数据执行重置
                const result = await this.processSubscription(latestSubscription, resetType);
                this.timerManager.clear(`delayed-reset-${subId}`);

                // 发送延迟重置结果通知
                await this.notifierManager.notify({
                    resetType: `${resetType}_DELAYED`,
                    startTime: Date.now(),
                    endTime: Date.now(),
                    totalDuration: 0,
                    totalSubscriptions: 1,
                    eligible: 1,
                    success: result.status === RESET_STATUS.SUCCESS ? 1 : 0,
                    failed: result.status === RESET_STATUS.FAILED ? 1 : 0,
                    skipped: 0,
                    scheduled: 0,
                    details: [result],
                });
            } catch (error) {
                Logger.error(`[订阅${subId}] 延迟重置失败`, error);
                this.timerManager.clear(`delayed-reset-${subId}`);

                // 发送失败通知
                await this.notifierManager.notify({
                    resetType: `${resetType}_DELAYED`,
                    startTime: Date.now(),
                    endTime: Date.now(),
                    totalDuration: 0,
                    totalSubscriptions: 1,
                    eligible: 1,
                    success: 0,
                    failed: 1,
                    skipped: 0,
                    scheduled: 0,
                    details: [{
                        subscriptionId: subId,
                        subscriptionName: subscription.subscriptionPlanName,
                        status: RESET_STATUS.FAILED,
                        message: error.message,
                        error: error.message,
                    }],
                });
            }
        }, delayMs);

        // 保存定时器引用
        this.timerManager.set(`delayed-reset-${subId}`, timerId);

        // 立即返回 SCHEDULED 状态，不等待定时器执行
        return {
            subscriptionId: subId,
            subscriptionName: subscription.subscriptionPlanName,
            status: RESET_STATUS.SCHEDULED,
            message: `已调度延迟重置，将在 ${TimeUtils.formatDateTime(cooldownEndTime)} 执行`,
            scheduledTime: cooldownEndTime,
        };
    }

    /**
     * 处理单个订阅
     * @param {Object} subscription - 订阅对象
     * @param {string} resetType - 检查点类型
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
            // 直接重置策略（无论余额多少）
            if (resetType === RESET_TYPES.FIRST) {
                Logger.info(
                    `[订阅${subId}] 执行第一次检查点重置（重置次数完整，当前余额 ${creditPercent.toFixed(1)}%）`
                );
            } else {
                Logger.info(
                    `[订阅${subId}] 执行第二次检查点重置（剩余次数 ${subscription.resetTimes}，当前余额 ${creditPercent.toFixed(1)}%）`
                );
            }

            // 执行重置
            await this.apiClient.resetCredits(subId);

            // 等待API更新（使用配置值）
            await new Promise(resolve => setTimeout(resolve, config.resetVerificationWaitMs));

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
        Logger.info('清理所有延迟定时器...');
        this.timerManager.clearAll();
    }
}

export default ResetService;
