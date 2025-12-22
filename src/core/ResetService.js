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
        // 保存脱敏的 API Key 用于通知标识
        this.apiKeyMask = Logger.sanitizeAPIKey(apiClient.apiKey);
    }

    /**
     * 格式化订阅标识（统一格式：[名称订阅(ID)]）
     * @param {Object} subscription - 订阅对象
     * @returns {string} 格式化的订阅标识
     */
    formatSubscriptionId(subscription) {
        const name = subscription.subscriptionPlanName || 'UNKNOWN';
        return `[${name}订阅(${subscription.id})]`;
    }

    isPayPerUse(subscription) {
        const planType = subscription.subscriptionPlan?.planType;
        return planType === SUBSCRIPTION_TYPES.PAY_PER_USE;
    }

    isExcludedByName(subscription) {
        const blacklist = config.excludePlanNames || [];
        if (blacklist.length === 0) return false;

        const name = (subscription.subscriptionPlan?.subscriptionName || '').trim().toLowerCase();
        return blacklist.some(n => n.trim().toLowerCase() === name);
    }

    /**
     * 判断订阅余额是否低于阈值
     * @param {Object} subscription - 订阅对象
     * @returns {boolean}
     */
    isLowBalance(subscription) {
        return (subscription.currentCredits || 0) < config.lowBalanceThreshold;
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
        const typeLabel = {
            [RESET_TYPES.FIRST]: '第一次检查点',
            [RESET_TYPES.SECOND]: '第二次检查点',
            [RESET_TYPES.MANUAL]: '手动',
            [RESET_TYPES.LOW_BALANCE]: '低余额检测',
        }[resetType] || resetType;

        Logger.info(`========== 开始执行${typeLabel}重置${config.dryRun ? ' [DRY-RUN模式]' : ''} ==========`);

        const result = {
            resetType,
            apiKeyMask: this.apiKeyMask, // 添加 API Key 标识
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
            Logger.info('获取订阅列表...');
            const subscriptions = await this.apiClient.getSubscriptions();
            result.totalSubscriptions = subscriptions.length;

            Logger.info(`获取到 ${subscriptions.length} 个订阅`);

            // 2. 过滤符合条件的订阅
            const eligibleSubscriptions = subscriptions.filter(sub =>
                this.isEligible(sub, resetType)
            );

            result.eligible = eligibleSubscriptions.length;

            Logger.info(`符合条件: ${eligibleSubscriptions.length} 个`);

            if (eligibleSubscriptions.length === 0) {
                Logger.warn('没有符合条件的订阅，跳过重置');
                result.endTime = Date.now();
                result.totalDuration = result.endTime - result.startTime;
                return result;
            }

            // 3. 逐个处理订阅（串行，避免触发限流）
            for (const subscription of eligibleSubscriptions) {
                // 第二次重置和低余额检测：支持延迟重置
                if (resetType === RESET_TYPES.SECOND || resetType === RESET_TYPES.LOW_BALANCE) {
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
        const subId = this.formatSubscriptionId(subscription);
        const lastReset = subscription.lastCreditReset
            ? TimeUtils.formatDateTime(subscription.lastCreditReset)
            : '从未重置';

        // P0: PAY_PER_USE 保护（最高优先级）
        if (this.isPayPerUse(subscription)) {
            Logger.warn(`${subId} 🚨 PAY_PER_USE 订阅，已跳过`);
            return false;
        }

        // P0.5: 订阅名称黑名单
        if (this.isExcludedByName(subscription)) {
            Logger.info(`${subId} 名称命中黑名单，已跳过`);
            return false;
        }

        // P1: 订阅类型检查（保留 PAYGO 保护）
        if (this.isPAYGO(subscription)) {
            Logger.warn(`${subId} 🚨 PAYGO订阅，已跳过`);
            return false;
        }

        // P1.6: 激活状态检查
        if (!subscription.isActive) {
            Logger.debug(`${subId} 订阅未激活，已跳过`);
            return false;
        }

        // P1.7: 订阅有效期检查（防止已过期但仍标记为激活的订阅触发重置）
        const statusLabel = (subscription.subscriptionStatus || '').trim();
        const statusLower = statusLabel.toLowerCase();
        const statusActive =
            !statusLabel ||
            statusLower === 'active' ||
            statusLower === '活跃中';

        if (!statusActive) {
            Logger.info(`${subId} 状态为${statusLabel || '未知'}，已跳过`);
            return false;
        }

        const remainingDays = Number(subscription.remainingDays);
        if (!Number.isNaN(remainingDays) && remainingDays <= 0) {
            Logger.info(`${subId} 剩余天数为${subscription.remainingDays}，已跳过`);
            return false;
        }

        // P2: 冷却检查（第二次检查点和低余额检测允许延迟重置）
        const cooldown = TimeUtils.checkCooldown(subscription.lastCreditReset);
        if (!cooldown.passed) {
            if (resetType === RESET_TYPES.FIRST) {
                // 第一次检查点：冷却未过直接跳过
                Logger.warn(`${subId} 冷却中（上次重置: ${lastReset}），还需 ${cooldown.formatted}`);
                return false;
            }
            // 第二次检查点和低余额检测：冷却未过也允许通过，进入延迟重置逻辑
            // 注意：这里不输出日志，避免与后续resetTimes检查的日志矛盾
            // 实际是否延迟重置由processSubscriptionWithDelay决定
        }

        // P3: 重置次数检查（核心策略）
        if (resetType === RESET_TYPES.FIRST) {
            // 第一次检查点：只在重置次数=2时重置（保守策略，保留重置机会）
            if (subscription.resetTimes < 2) {
                Logger.info(
                    `${subId} 第一次检查跳过（剩余${subscription.resetTimes}次，保留给第二次检查）`
                );
                return false;
            }
        } else if (resetType === RESET_TYPES.SECOND) {
            // 第二次检查点：重置次数>=1就重置（兜底策略，最大化利用）
            if (subscription.resetTimes < 1) {
                Logger.info(
                    `${subId} 第二次检查跳过（剩余${subscription.resetTimes}次，次数已用完）`
                );
                return false;
            }
        } else if (resetType === RESET_TYPES.LOW_BALANCE) {
            // 低余额检测：需要 resetTimes >= 1 且余额低于阈值
            if (subscription.resetTimes < 1) {
                Logger.info(`${subId} 低余额检测跳过（剩余${subscription.resetTimes}次，次数已用完）`);
                return false;
            }
            if (!this.isLowBalance(subscription)) {
                Logger.debug(
                    `${subId} 余额 ${(subscription.currentCredits || 0).toFixed(2)} 美元，` +
                    `未低于阈值 ${config.lowBalanceThreshold} 美元`
                );
                return false;
            }
            Logger.info(
                `${subId} 余额 ${(subscription.currentCredits || 0).toFixed(2)} 美元，` +
                `低于阈值 ${config.lowBalanceThreshold} 美元，触发重置`
            );
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
        const subId = this.formatSubscriptionId(subscription);
        const cooldown = TimeUtils.checkCooldown(subscription.lastCreditReset);

        // 如果冷却已过，直接重置
        if (cooldown.passed) {
            return await this.processSubscription(subscription, resetType);
        }

        // 冷却未满，精确计算下次可重置时间
        const cooldownEndTime = TimeUtils.getCooldownEndTime(subscription.lastCreditReset);

        // 跨天检测：如果延迟执行会跨过午夜，放弃延迟重置以保留次日配额
        const endOfDay = TimeUtils.getEndOfDay();
        if (cooldownEndTime > endOfDay) {
            const lastReset = TimeUtils.formatDateTime(subscription.lastCreditReset);
            const scheduledTime = TimeUtils.formatDateTime(cooldownEndTime);
            Logger.warn(
                `${subId} 延迟重置将跨天执行（上次重置: ${lastReset}，预计执行: ${scheduledTime}），` +
                `为避免浪费次日配额，跳过本次延迟重置`
            );
            return {
                subscriptionId: subscription.id,
                subscriptionName: subscription.subscriptionPlanName,
                status: RESET_STATUS.SKIPPED,
                message: '延迟重置将跨天，跳过以保留次日配额',
                reason: 'CROSS_MIDNIGHT',
            };
        }

        const now = Date.now();
        const delayMs = Math.max(0, cooldownEndTime - now + 1000); // 额外等待1秒缓冲
        const lastReset = TimeUtils.formatDateTime(subscription.lastCreditReset);

        Logger.info(
            `${subId} 冷却中（上次重置: ${lastReset}），已调度延迟重置，` +
            `将在 ${TimeUtils.formatDateTime(cooldownEndTime)} 执行（${cooldown.formatted}后）`
        );

        // 创建后台延迟定时器（不阻塞主流程）
        const timerId = setTimeout(async () => {
            Logger.info(`${subId} 开始执行延迟重置`);

            try {
                // 重新获取最新的订阅信息（避免使用过期数据）
                const latestSubscriptions = await this.apiClient.getSubscriptions();
                const latestSubscription = latestSubscriptions.find(s => s.id === subscription.id);

                if (!latestSubscription) {
                    Logger.error(`${subId} 订阅不存在，取消延迟重置`);
                    this.timerManager.clear(`delayed-reset-${subscription.id}`);
                    return;
                }

                // 使用最新数据执行重置
                const result = await this.processSubscription(latestSubscription, resetType);
                this.timerManager.clear(`delayed-reset-${subscription.id}`);

                // 发送延迟重置结果通知
                await this.notifierManager.notify({
                    resetType: `${resetType}_DELAYED`,
                    apiKeyMask: this.apiKeyMask, // 添加 API Key 标识
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
                Logger.error(`${subId} 延迟重置失败`, error);
                this.timerManager.clear(`delayed-reset-${subscription.id}`);

                // 发送失败通知
                await this.notifierManager.notify({
                    resetType: `${resetType}_DELAYED`,
                    apiKeyMask: this.apiKeyMask, // 添加 API Key 标识
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
        this.timerManager.set(`delayed-reset-${subscription.id}`, timerId);

        // 立即返回 SCHEDULED 状态，不等待定时器执行
        return {
            subscriptionId: subscription.id,
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
        const subId = this.formatSubscriptionId(subscription);
        const creditPercent = (subscription.currentCredits / subscription.subscriptionPlan.creditLimit) * 100;

        const detail = {
            subscriptionId: subscription.id,
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
                    `${subId} 执行第一次检查点重置（剩余${subscription.resetTimes}次，当前余额 ${creditPercent.toFixed(1)}%）`
                );
            } else if (resetType === RESET_TYPES.LOW_BALANCE) {
                Logger.info(
                    `${subId} 执行低余额重置（剩余${subscription.resetTimes}次，当前余额 ${subscription.currentCredits.toFixed(2)} 美元）`
                );
            } else {
                Logger.info(
                    `${subId} 执行第二次检查点重置（剩余${subscription.resetTimes}次，当前余额 ${creditPercent.toFixed(1)}%）`
                );
            }

            // 执行重置（或dry-run模式跳过）
            if (config.dryRun) {
                Logger.info(`${subId} [DRY-RUN] 跳过实际重置操作`);
                detail.status = RESET_STATUS.SKIPPED;
                detail.message = '[DRY-RUN] 测试模式，跳过重置';
                return detail;
            }

            await this.apiClient.resetCredits(subscription.id);

            // 等待API更新（使用配置值）
            await new Promise(resolve => setTimeout(resolve, config.resetVerificationWaitMs));

            // 重新获取订阅信息验证
            const updatedSubscriptions = await this.apiClient.getSubscriptions();
            const updated = updatedSubscriptions.find(s => s.id === subscription.id);

            if (updated) {
                detail.afterCredits = updated.currentCredits;
                detail.afterResetTimes = updated.resetTimes;

                // 检测无效重置（API返回成功但数据未变化）
                const creditsUnchanged = Math.abs(detail.beforeCredits - detail.afterCredits) < 0.01;
                const resetTimesUnchanged = detail.beforeResetTimes === detail.afterResetTimes;

                if (creditsUnchanged && resetTimesUnchanged) {
                    // 无效重置：通常发生在FREE订阅或其他API限制
                    Logger.warn(
                        `${subId} API调用成功但数据未变化: ` +
                        `${detail.beforeCredits.toFixed(2)} credits, resetTimes ${detail.beforeResetTimes} ` +
                        `（可能是FREE订阅或其他限制）`
                    );
                    detail.status = RESET_STATUS.SKIPPED;
                    detail.message = 'API返回成功但数据未变化';
                } else if (detail.beforeResetTimes < detail.afterResetTimes) {
                    // 检测到跨天刷新（resetTimes增加）
                    Logger.success(
                        `${subId} 重置成功: ` +
                        `${detail.beforeCredits.toFixed(2)} → ${detail.afterCredits.toFixed(2)} credits, ` +
                        `resetTimes ${detail.beforeResetTimes} → ${detail.afterResetTimes} ` +
                        `（检测到跨天刷新，次数已恢复）`
                    );
                    detail.message = '重置成功（跨天刷新）';
                } else {
                    // 正常重置
                    Logger.success(
                        `${subId} 重置成功: ` +
                        `${detail.beforeCredits.toFixed(2)} → ${detail.afterCredits.toFixed(2)} credits, ` +
                        `resetTimes ${detail.beforeResetTimes} → ${detail.afterResetTimes}`
                    );
                    detail.message = '重置成功';
                }
            } else {
                detail.message = '重置成功（未能验证结果）';
            }

        } catch (error) {
            Logger.error(`${subId} 重置失败`, error);
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
