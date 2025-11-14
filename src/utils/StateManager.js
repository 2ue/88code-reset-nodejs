/**
 * 状态管理工具
 * 用于 GitHub Actions 的幂等性检查和状态持久化
 */

import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Logger from './Logger.js';
import TimeUtils from './TimeUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

/**
 * 状态管理器类
 */
class StateManager {
    constructor() {
        this.stateDir = process.env.STATE_DIR || join(rootDir, '.github');
        this.stateFile = join(this.stateDir, 'reset-state.json');
        this.state = null;
    }

    /**
     * 初始化状态管理器
     */
    async init() {
        try {
            // 确保 .github 目录存在
            await fs.mkdir(this.stateDir, { recursive: true });

            // 读取现有状态
            await this.loadState();
        } catch (error) {
            Logger.error(`初始化状态管理器失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 加载状态文件
     */
    async loadState() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf8');
            this.state = JSON.parse(data);
            Logger.debug(`加载状态: ${JSON.stringify(this.state)}`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，创建初始状态
                this.state = {
                    lastExecutionDate: null,
                    executionHistory: [],
                    failures: []
                };
            } else {
                Logger.error(`读取状态文件失败: ${error.message}`);
                throw error;
            }
        }
    }

    /**
     * 保存状态文件
     */
    async saveState() {
        try {
            const stateData = JSON.stringify(this.state, null, 2);
            await fs.writeFile(this.stateFile, stateData, 'utf8');
            Logger.debug(`保存状态: ${JSON.stringify(this.state)}`);
        } catch (error) {
            Logger.error(`保存状态文件失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 获取今天日期 (YYYY-MM-DD)
     */
    getTodayDate() {
        return TimeUtils.getTodayDateString();
    }

    /**
     * 检查今天是否已执行过特定类型的重置
     * @param {string} resetType - 重置类型 (FIRST | SECOND)
     * @returns {Promise<boolean>}
     */
    async hasExecutedToday(resetType) {
        if (!this.state) {
            await this.loadState();
        }

        const today = this.getTodayDate();
        const lastExecution = this.state.executionHistory
            .filter(exec => exec.date === today && exec.type === resetType)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        if (lastExecution) {
            const formatted = TimeUtils.formatDateTime(lastExecution.timestamp);
            Logger.info(`今天已执行过${resetType}重置 (${formatted})`);
            return true;
        }

        return false;
    }

    /**
     * 记录执行成功
     * @param {string} resetType - 重置类型
     * @param {object} result - 执行结果
     */
    async recordSuccess(resetType, result) {
        if (!this.state) {
            await this.loadState();
        }

        const today = this.getTodayDate();

        // 添加执行记录
        this.state.executionHistory.push({
            date: today,
            type: resetType,
            status: 'success',
            timestamp: TimeUtils.nowInApiTimezone().toDate().toISOString(),
            result
        });

        // 更新最后执行日期
        this.state.lastExecutionDate = today;

        // 清理旧记录（保留最近30天）
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        this.state.executionHistory = this.state.executionHistory.filter(
            exec => new Date(exec.timestamp) > cutoffDate
        );

        // 清理失败记录
        this.state.failures = this.state.failures.filter(
            failure => new Date(failure.timestamp) > cutoffDate
        );

        await this.saveState();
        Logger.info(`记录${resetType}重置成功: ${JSON.stringify(result)}`);
    }

    /**
     * 记录执行失败
     * @param {string} resetType - 重置类型
     * @param {Error} error - 错误信息
     */
    async recordFailure(resetType, error) {
        if (!this.state) {
            await this.loadState();
        }

        // 添加失败记录
        this.state.failures.push({
            date: this.getTodayDate(),
            type: resetType,
            status: 'failure',
            timestamp: TimeUtils.nowInApiTimezone().toDate().toISOString(),
            error: {
                message: error.message,
                stack: error.stack
            }
        });

        // 保留最近30天的失败记录
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        this.state.failures = this.state.failures.filter(
            failure => new Date(failure.timestamp) > cutoffDate
        );

        await this.saveState();
        Logger.error(`记录${resetType}重置失败: ${error.message}`);
    }

    /**
     * 获取最近的失败次数（用于决定是否跳过）
     * @param {number} hours - 检查最近N小时
     */
    getRecentFailureCount(hours = 24) {
        if (!this.state) return 0;

        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - hours);

        return this.state.failures.filter(
            failure => new Date(failure.timestamp) > cutoffTime
        ).length;
    }

    /**
     * 获取执行统计信息
     */
    getExecutionStats() {
        if (!this.state) {
            return { today: { first: false, second: false }, failures: 0 };
        }

        const today = this.getTodayDate();
        const todayExecutions = this.state.executionHistory.filter(
            exec => exec.date === today && exec.status === 'success'
        );

        const stats = {
            today: {
                first: todayExecutions.some(exec => exec.type === 'FIRST'),
                second: todayExecutions.some(exec => exec.type === 'SECOND')
            },
            failures: this.getRecentFailureCount(24),
            lastExecutionDate: this.state.lastExecutionDate,
            totalExecutions: this.state.executionHistory.length,
            totalFailures: this.state.failures.length
        };

        return stats;
    }

    /**
     * 清理状态（用于测试或重置）
     */
    async clearState() {
        this.state = {
            lastExecutionDate: null,
            executionHistory: [],
            failures: []
        };
        await this.saveState();
        Logger.info('状态已清理');
    }
}

// 导出单例实例
export default new StateManager();
