/**
 * 重试工具
 * 提供指数退避重试机制
 */

import Logger from './Logger.js';
import config from '../config.js';

export class RetryHelper {
    /**
     * 带重试的函数执行
     * @param {Function} fn - 要执行的异步函数
     * @param {Object} options - 重试选项
     * @returns {Promise<any>} 函数执行结果
     */
    static async withRetry(fn, options = {}) {
        const {
            maxRetries = config.maxRetries,
            baseDelay = config.retryBaseDelay,
            maxDelay = 10000,
            shouldRetry = RetryHelper.defaultShouldRetry,
        } = options;

        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // 执行函数
                const result = await fn();
                return result;

            } catch (error) {
                lastError = error;

                // 检查是否应该重试
                if (attempt === maxRetries || !shouldRetry(error)) {
                    throw error;
                }

                // 计算延迟时间（指数退避）
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt),
                    maxDelay
                );

                Logger.warn(
                    `重试 ${attempt + 1}/${maxRetries}，延迟 ${delay}ms`,
                    {
                        error: error.message,
                        errorCode: error.code,
                    }
                );

                // 等待后重试
                await RetryHelper.sleep(delay);
            }
        }

        // 所有重试都失败
        throw lastError;
    }

    /**
     * 默认的重试判断逻辑
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否应该重试
     */
    static defaultShouldRetry(error) {
        // 网络错误应该重试
        if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET') {
            return true;
        }

        // 超时错误应该重试
        if (error.code === 'ETIMEDOUT') {
            return true;
        }

        // HTTP 5xx错误应该重试
        if (error.response && error.response.status >= 500) {
            return true;
        }

        // HTTP 429限流应该重试
        if (error.response && error.response.status === 429) {
            return true;
        }

        // 其他错误不重试
        return false;
    }

    /**
     * 睡眠指定时间
     * @param {number} ms - 毫秒数
     */
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 带超时的Promise执行
     * @param {Promise} promise - Promise对象
     * @param {number} timeoutMs - 超时时间（毫秒）
     * @returns {Promise<any>}
     */
    static async withTimeout(promise, timeoutMs) {
        let timeoutHandle;

        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`操作超时 (${timeoutMs}ms)`));
            }, timeoutMs);
        });

        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutHandle);
            return result;
        } catch (error) {
            clearTimeout(timeoutHandle);
            throw error;
        }
    }

    /**
     * 批量执行，带并发控制
     * @param {Array} items - 要处理的项目数组
     * @param {Function} fn - 处理函数
     * @param {number} concurrency - 并发数
     * @returns {Promise<Array>} 结果数组
     */
    static async batchExecute(items, fn, concurrency = 3) {
        const results = [];
        const queue = [...items];

        const workers = Array(concurrency).fill(null).map(async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (item) {
                    const result = await fn(item);
                    results.push(result);
                }
            }
        });

        await Promise.all(workers);
        return results;
    }
}

export default RetryHelper;
