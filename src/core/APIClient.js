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
                    const hasToken = await APIClient.rateLimiter.waitForToken(config.rateLimitWaitTimeout);
                    if (!hasToken) {
                        throw new Error('RATE_LIMIT_EXCEEDED: 等待令牌超时');
                    }
                }

                // 添加Authorization头（使用标准Bearer Token格式）
                requestConfig.headers.Authorization = `Bearer ${this.apiKey}`;

                // 详细API请求日志（可配置开关）
                if (config.enableApiRequestLog) {
                    Logger.info(
                        `[API请求] ${requestConfig.method.toUpperCase()} ${requestConfig.baseURL}${requestConfig.url}`
                    );
                    Logger.info(
                        `[请求头] ${JSON.stringify({
                            ...requestConfig.headers,
                            Authorization: Logger.sanitizeAPIKey(requestConfig.headers.Authorization)
                        }, null, 2)}`
                    );
                    if (requestConfig.data) {
                        Logger.info(`[请求体] ${JSON.stringify(requestConfig.data, null, 2)}`);
                    }
                } else {
                    Logger.debug(
                        `API请求: ${requestConfig.method.toUpperCase()} ${requestConfig.url}`,
                        {
                            apiKey: Logger.sanitizeAPIKey(this.apiKey),
                        }
                    );
                }

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
                // 详细API响应日志（可配置开关）
                if (config.enableApiRequestLog) {
                    Logger.info(
                        `[API响应] ${response.status} ${response.statusText} ${response.config.method.toUpperCase()} ${response.config.url}`
                    );
                    Logger.info(
                        `[响应头] ${JSON.stringify(response.headers, null, 2)}`
                    );
                    if (response.data) {
                        const dataStr = typeof response.data === 'object'
                            ? JSON.stringify(response.data, null, 2)
                            : String(response.data);
                        // 限制响应体日志长度，避免过大
                        const maxLength = 5000;
                        if (dataStr.length > maxLength) {
                            Logger.info(`[响应体] ${dataStr.substring(0, maxLength)}... (已截断，总长度: ${dataStr.length})`);
                        } else {
                            Logger.info(`[响应体] ${dataStr}`);
                        }
                    }
                } else {
                    Logger.debug(
                        `API响应: ${response.status} ${response.config.url}`,
                        {
                            status: response.status,
                            statusText: response.statusText,
                        }
                    );
                }

                return response;
            },
            (error) => {
                if (error.response) {
                    const { status, statusText, data } = error.response;

                    // 详细错误日志（可配置开关）
                    if (config.enableApiRequestLog) {
                        Logger.error(`[API错误] ${status} ${statusText} ${error.config.method.toUpperCase()} ${error.config.url}`);
                        Logger.error(`[错误响应体] ${JSON.stringify(data, null, 2)}`);
                    } else {
                        Logger.error(
                            `API错误: ${status} ${statusText} ${error.config.url}`,
                            null,
                            {
                                status,
                                statusText,
                                data: typeof data === 'object' ? JSON.stringify(data) : data,
                            }
                        );
                    }

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
            // 处理 ResponseDTO 包装层（如果存在）
            // 兼容两种响应格式：直接数据 或 {code, ok, msg, data} 包装
            const responseData = response.data;
            if (responseData && typeof responseData === 'object' && 'data' in responseData && 'ok' in responseData) {
                // ResponseDTO 格式
                return responseData.data;
            }
            // 直接返回数据格式（向后兼容）
            return responseData;
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
        const execute = async () => {
            const response = await this.client.post(API_ENDPOINTS.SUBSCRIPTION);
            // 处理 ResponseDTO 包装层（如果存在）
            const responseData = response.data;
            if (responseData && typeof responseData === 'object' && 'data' in responseData && 'ok' in responseData) {
                // ResponseDTO 格式
                return responseData.data;
            }
            // 直接返回数据格式（向后兼容）
            return responseData;
        };

        const subscriptions = config.enableRetry
            ? await RetryHelper.withRetry(execute)
            : await execute();

        return subscriptions;
    }

    /**
     * 重置积分
     * @param {number} subscriptionId - 订阅ID
     * @returns {Promise<Object>} 重置响应
     */
    async resetCredits(subscriptionId) {
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

            // 处理 ResponseDTO 包装层（如果存在）
            const responseData = response.data;
            if (responseData && typeof responseData === 'object' && 'data' in responseData && 'ok' in responseData) {
                // ResponseDTO 格式 - 返回整个响应（包含 ok, msg 等元信息）
                return {
                    success: responseData.ok,
                    message: responseData.msg,
                    data: responseData.data,
                };
            }

            // 直接返回数据格式（向后兼容）
            return responseData;
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
