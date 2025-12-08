/**
 * 调度器
 * 使用node-cron实现定时任务
 */

import cron from 'node-cron';
import Logger from '../utils/Logger.js';
import { RESET_TYPES, LOCK_NAMES } from '../constants.js';
import TimeUtils from '../utils/TimeUtils.js';
import config from '../config.js';

class ExecutionLock {
    constructor() {
        this.locks = new Map();
    }

    async acquire(taskName) {
        if (this.locks.get(taskName)) {
            return false;
        }
        this.locks.set(taskName, true);
        return true;
    }

    release(taskName) {
        this.locks.delete(taskName);
    }
}

export class Scheduler {
    constructor(resetService, fileStorage = null) {
        this.resetService = resetService;
        this.fileStorage = fileStorage;
        this.lock = new ExecutionLock();
        this.jobs = [];
    }

    async start() {
        Logger.info('========== 调度器启动 ==========');

        // 启动时清理一次旧历史文件
        if (this.fileStorage) {
            Logger.info('清理旧历史文件...');
            await this.fileStorage.cleanOldHistory();
        }

        // 第一次重置检查任务
        const firstCron = TimeUtils.toCronExpression(config.firstResetTime);
        const firstJob = cron.schedule(firstCron, () => {
            this.executeWithLock(LOCK_NAMES.FIRST_RESET, RESET_TYPES.FIRST);
        }, { timezone: config.timezone });

        this.jobs.push({ name: 'first-reset', job: firstJob });

        // 第二次重置检查任务
        const secondCron = TimeUtils.toCronExpression(config.secondResetTime);
        const secondJob = cron.schedule(secondCron, () => {
            this.executeWithLock(LOCK_NAMES.SECOND_RESET, RESET_TYPES.SECOND);
        }, { timezone: config.timezone });

        this.jobs.push({ name: 'second-reset', job: secondJob });

        // 每天凌晨00:00执行历史文件清理
        if (this.fileStorage) {
            const cleanupJob = cron.schedule('0 0 * * *', async () => {
                Logger.info('开始定期清理旧历史文件...');
                await this.fileStorage.cleanOldHistory();
            }, { timezone: config.timezone });

            this.jobs.push({ name: 'cleanup', job: cleanupJob });
        }

        // 低余额检测任务（可选）
        if (config.enableLowBalanceReset) {
            const lowBalanceCron = TimeUtils.toCronExpression(config.lowBalanceCheckTime);
            const lowBalanceJob = cron.schedule(lowBalanceCron, () => {
                this.executeWithLock(LOCK_NAMES.LOW_BALANCE_RESET, RESET_TYPES.LOW_BALANCE);
            }, { timezone: config.timezone });

            this.jobs.push({ name: 'low-balance-reset', job: lowBalanceJob });
            Logger.info(`低余额检测: 每天 ${config.lowBalanceCheckTime}，阈值 ${config.lowBalanceThreshold} 美元`);
        }

        // 计算下次执行时间
        const nextFirst = TimeUtils.getMillisUntilNext(config.firstResetTime);
        const nextSecond = TimeUtils.getMillisUntilNext(config.secondResetTime);

        const now = new Date();
        const nextFirstTime = new Date(now.getTime() + nextFirst);
        const nextSecondTime = new Date(now.getTime() + nextSecond);

        const formatTime = (date) => {
            return date.toLocaleString('zh-CN', {
                timeZone: config.timezone,
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');
        };

        Logger.info(`定时检查: 每天 ${config.firstResetTime} 和 ${config.secondResetTime}`);
        Logger.info(`下次执行: ${formatTime(nextFirstTime)} (${TimeUtils.formatDuration(nextFirst)}后)`);
        Logger.info(`          ${formatTime(nextSecondTime)} (${TimeUtils.formatDuration(nextSecond)}后)`);

        // 显示低额度检测的下次执行时间
        if (config.enableLowBalanceReset) {
            const nextLowBalance = TimeUtils.getMillisUntilNext(config.lowBalanceCheckTime);
            const nextLowBalanceTime = new Date(now.getTime() + nextLowBalance);
            Logger.info(`低额度检测: ${formatTime(nextLowBalanceTime)} (${TimeUtils.formatDuration(nextLowBalance)}后)`);
        }
    }

    async executeWithLock(lockName, resetType) {
        if (!await this.lock.acquire(lockName)) {
            Logger.warn(`任务${lockName}已在执行中，跳过`);
            return;
        }

        try {
            await this.resetService.executeReset(resetType);
        } finally {
            this.lock.release(lockName);
        }
    }

    stop() {
        Logger.info('停止调度器...');
        this.jobs.forEach(({ name, job }) => {
            job.stop();
            Logger.info(`已停止任务: ${name}`);
        });
    }
}

export default Scheduler;
