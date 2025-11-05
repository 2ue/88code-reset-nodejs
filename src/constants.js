/**
 * 常量定义
 */

import config from './config.js';

// API端点
export const API_ENDPOINTS = {
    USAGE: '/api/usage',
    SUBSCRIPTION: '/api/subscription',
    RESET_CREDITS: '/api/reset-credits',
};

// 订阅类型
export const SUBSCRIPTION_TYPES = {
    MONTHLY: 'MONTHLY',
    PAYGO: 'PAYGO',
    PAY_PER_USE: 'PAY_PER_USE',
};

// 重置类型
export const RESET_TYPES = {
    FIRST: 'FIRST',   // 首次重置（18:55）
    SECOND: 'SECOND', // 二次重置（23:55）
    MANUAL: 'MANUAL', // 手动重置
};

// 重置状态
export const RESET_STATUS = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED',
    PARTIAL: 'PARTIAL',
};

// 冷却期（从配置读取，单位：毫秒）
export const COOLDOWN_PERIOD = config.cooldownHours * 60 * 60 * 1000;

// 延迟重置配置（从配置读取）
export const DELAYED_RESET_CONFIG = {
    // 当天最晚重置时间缓冲（单位：毫秒）
    // 默认10秒，确保在00:00前完成
    END_OF_DAY_BUFFER: config.endOfDayBuffer * 1000,
    // 一天的毫秒数
    DAY_IN_MS: 24 * 60 * 60 * 1000,
};

// HTTP状态码
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
};

// 错误代码
export const ERROR_CODES = {
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
    API_ERROR: 'API_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PAYGO_PROTECTED: 'PAYGO_PROTECTED',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    INSUFFICIENT_RESET_TIMES: 'INSUFFICIENT_RESET_TIMES',
};

// 日志级别
export const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
};

// 任务锁名称
export const LOCK_NAMES = {
    FIRST_RESET: 'first-reset',
    SECOND_RESET: 'second-reset',
};

export default {
    API_ENDPOINTS,
    SUBSCRIPTION_TYPES,
    RESET_TYPES,
    RESET_STATUS,
    COOLDOWN_PERIOD,
    DELAYED_RESET_CONFIG,
    HTTP_STATUS,
    ERROR_CODES,
    LOG_LEVELS,
    LOCK_NAMES,
};
