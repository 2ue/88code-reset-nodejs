/**
 * 速率限制器
 * 使用令牌桶算法实现
 */

import Logger from './Logger.js';

export class RateLimiter {
    /**
     * @param {number} capacity - 桶容量（令牌数）
     * @param {number} refillRate - 补充速率（令牌/分钟）
     */
    constructor(capacity, refillRate) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity;
        this.lastRefill = Date.now();

        Logger.info(`速率限制器已初始化: 容量=${capacity}, 补充速率=${refillRate}/分钟`);
    }

    /**
     * 补充令牌
     */
    refill() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;

        // 每分钟补充refillRate个令牌
        const refillInterval = 60000; // 1分钟
        const tokensToAdd = (timePassed / refillInterval) * this.refillRate;

        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
            this.lastRefill = now;

            Logger.debug(`令牌补充: +${tokensToAdd.toFixed(2)}, 当前=${this.tokens.toFixed(2)}`);
        }
    }

    /**
     * 尝试消费一个令牌
     * @returns {boolean} 是否成功消费
     */
    tryConsume() {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            Logger.debug(`消费令牌: 剩余=${this.tokens.toFixed(2)}/${this.capacity}`);
            return true;
        }

        Logger.warn(`速率限制: 令牌不足 (${this.tokens.toFixed(2)}/${this.capacity})`);
        return false;
    }

    /**
     * 等待直到有令牌可用
     * @param {number} maxWaitMs - 最大等待时间（毫秒）
     * @returns {Promise<boolean>} 是否成功获取令牌
     */
    async waitForToken(maxWaitMs = 60000) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            if (this.tryConsume()) {
                return true;
            }

            // 等待1秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        Logger.error(`速率限制超时: 等待${maxWaitMs}ms后仍无令牌可用`);
        return false;
    }

    /**
     * 获取当前可用令牌数
     */
    getAvailableTokens() {
        this.refill();
        return Math.floor(this.tokens);
    }

    /**
     * 获取速率限制状态
     */
    getStatus() {
        return {
            capacity: this.capacity,
            available: this.getAvailableTokens(),
            refillRate: this.refillRate,
            utilizationPercent: ((this.capacity - this.tokens) / this.capacity * 100).toFixed(1),
        };
    }
}

export default RateLimiter;
