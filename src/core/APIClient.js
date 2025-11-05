/**
 * API客户端
 * 负责与88code API进行通信
 */

import axios from 'axios';
import Logger from '../utils/Logger.js';
import RateLimiter from '../utils/RateLimiter.js';
import RetryHelper from '../utils/RetryHelper.js';
import { API_ENDPOINTS, HTTP_STATUS } from '../constants.js';
import config from '../config.js';

export class APIClient {
    constructor(apiKey) {
        this.apiKey = apiKey;

        // 创建速率限制器（单例模式，全局共享）
        if (!APIClient.rateLimiter && config.enableRateLimit) {
            APIClient.rateLimiter = new RateLimiter(
                config.rateLimitCapacity,
                config.rateLimitRefillRate
            );
        }

        // 创建axios实例
        this.client = axios.create({
            baseURL: config.apiBaseURL,
            timeout: config.apiTimeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.setupInterceptors();
    }

    /**
     * 设置请求/响应拦截器
     */
    setupInterceptors() {
        // 请求拦截器
        this.client.interceptors.request.use(
            async (requestConfig) => {
                // 速率限制检查
                if (config.enableRateLimit && APIClient.rateLimiter) {
                    const hasToken = await APIClient.rateLimiter.waitForToken(60000);
                    if (!hasToken) {
                        throw new Error('RATE_LIMIT_EXCEEDED: 等待令牌超时');
                    }
                }

                // 添加Authorization头
                requestConfig.headers.Authorization = this.apiKey;

                Logger.debug(
                    `API请求: ${requestConfig.method.toUpperCase()} ${requestConfig.url}`,
                    {
                        apiKey: Logger.sanitizeAPIKey(this.apiKey),
                    }
                );

                return requestConfig;
            },
            (error) => {
                Logger.error('请求拦截器错误', error);
                return Promise.reject(error);
            }
        );

        // 响应拦截器
        this.client.interceptors.response.use(
            (response) => {
                Logger.debug(
                    `API响应: ${response.status} ${response.config.url}`,
                    {
                        status: response.status,
                        statusText: response.statusText,
                    }
                );

                return response;
            },
            (error) => {
                if (error.response) {
                    const { status, statusText, data } = error.response;

                    Logger.error(
                        `API错误: ${status} ${statusText} ${error.config.url}`,
                        null,
                        {
                            status,
                            statusText,
                            data: typeof data === 'object' ? JSON.stringify(data) : data,
                        }
                    );

                    // 特殊处理429限流
                    if (status === HTTP_STATUS.TOO_MANY_REQUESTS) {
                        error.message = `API限流 (429)，请稍后重试`;
                    }

                    // 特殊处理401未授权
                    if (status === HTTP_STATUS.UNAUTHORIZED) {
                        error.message = `API Key无效 (401)`;
                    }
                } else if (error.request) {
                    Logger.error(`网络错误: ${error.message}`, error);
                } else {
                    Logger.error(`请求配置错误: ${error.message}`, error);
                }

                return Promise.reject(error);
            }
        );
    }

    /**
     * 获取用量信息
     * @returns {Promise<Object>} 用量信息
     */
    async getUsage() {
        const execute = async () => {
            const response = await this.client.post(API_ENDPOINTS.USAGE);
            return response.data;
        };

        if (config.enableRetry) {
            return await RetryHelper.withRetry(execute);
        } else {
            return await execute();
        }
    }

    /**
     * 获取订阅列表
     * @returns {Promise<Array>} 订阅列表
     */
    async getSubscriptions() {
        Logger.info('获取订阅列表...');

        const execute = async () => {
            const response = await this.client.post(API_ENDPOINTS.SUBSCRIPTION);
            return response.data;
        };

        const subscriptions = config.enableRetry
            ? await RetryHelper.withRetry(execute)
            : await execute();

        Logger.info(`获取到 ${subscriptions.length} 个订阅`);

        return subscriptions;
    }

    /**
     * 重置积分
     * @param {number} subscriptionId - 订阅ID
     * @returns {Promise<Object>} 重置响应
     */
    async resetCredits(subscriptionId) {
        Logger.info(`开始重置订阅: ${subscriptionId}`);

        const execute = async () => {
            const endpoint = `${API_ENDPOINTS.RESET_CREDITS}/${subscriptionId}`;
            const response = await this.client.post(endpoint);

            // 处理空响应或204状态码
            if (response.status === HTTP_STATUS.NO_CONTENT || !response.data) {
                return {
                    success: true,
                    message: '重置成功',
                    data: {
                        subscriptionId: String(subscriptionId),
                    },
                };
            }

            return response.data;
        };

        const result = config.enableRetry
            ? await RetryHelper.withRetry(execute, {
                shouldRetry: (error) => {
                    // 401和403不重试
                    if (error.response) {
                        const status = error.response.status;
                        if (status === HTTP_STATUS.UNAUTHORIZED || status === HTTP_STATUS.FORBIDDEN) {
                            return false;
                        }
                    }
                    return RetryHelper.defaultShouldRetry(error);
                },
            })
            : await execute();

        // 验证响应
        if (result.success === false) {
            throw new Error(result.message || '重置失败');
        }

        Logger.success(`订阅 ${subscriptionId} 重置成功`);

        return result;
    }

    /**
     * 测试连接
     * @returns {Promise<boolean>} 是否连接成功
     */
    async testConnection() {
        try {
            await this.getUsage();
            return true;
        } catch (error) {
            return false;
        }
    }
}

export default APIClient;
