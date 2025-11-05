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
    constructor(resetService) {
        this.resetService = resetService;
        this.lock = new ExecutionLock();
        this.jobs = [];
    }

    async start() {
        Logger.info('========== 调度器启动 ==========');

        // 首次重置任务
        const firstCron = TimeUtils.toCronExpression(config.firstResetTime);
        const firstJob = cron.schedule(firstCron, () => {
            this.executeWithLock(LOCK_NAMES.FIRST_RESET, RESET_TYPES.FIRST);
        }, { timezone: config.timezone });

        this.jobs.push({ name: 'first-reset', job: firstJob });

        // 二次重置任务
        const secondCron = TimeUtils.toCronExpression(config.secondResetTime);
        const secondJob = cron.schedule(secondCron, () => {
            this.executeWithLock(LOCK_NAMES.SECOND_RESET, RESET_TYPES.SECOND);
        }, { timezone: config.timezone });

        this.jobs.push({ name: 'second-reset', job: secondJob });

        Logger.info(`首次重置: ${config.firstResetTime} (${config.timezone})`);
        Logger.info(`二次重置: ${config.secondResetTime} (${config.timezone})`);

        // 显示下次执行时间
        const nextFirst = TimeUtils.getMillisUntilNext(config.firstResetTime);
        const nextSecond = TimeUtils.getMillisUntilNext(config.secondResetTime);

        Logger.info(`下次首次重置: ${TimeUtils.formatDuration(nextFirst)}后`);
        Logger.info(`下次二次重置: ${TimeUtils.formatDuration(nextSecond)}后`);
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
