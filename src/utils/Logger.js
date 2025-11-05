/**
 * 日志系统
 * 基于winston实现，支持控制台和文件输出
 */

import winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import config from '../config.js';

const { combine, timestamp, printf, colorize } = winston.format;

// 确保日志目录存在
if (!existsSync(config.logDir)) {
    mkdirSync(config.logDir, { recursive: true });
}

// 自定义日志格式
const customFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // 如果有额外的metadata，添加到日志中
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
});

// 创建logger实例
const logger = winston.createLogger({
    level: config.logLevel,
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [],
});

// 控制台输出（带颜色）
logger.add(new winston.transports.Console({
    format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
}));

// 文件输出（如果启用）
if (config.logFileEnabled) {
    // 所有日志
    logger.add(new winston.transports.File({
        filename: join(config.logDir, 'combined.log'),
        maxsize: config.logMaxSize * 1024 * 1024, // MB to bytes
        maxFiles: config.logMaxDays,
    }));

    // 错误日志
    logger.add(new winston.transports.File({
        filename: join(config.logDir, 'error.log'),
        level: 'error',
        maxsize: config.logMaxSize * 1024 * 1024,
        maxFiles: config.logMaxDays,
    }));

    // 按日期分割的日志
    const today = new Date().toISOString().split('T')[0];
    logger.add(new winston.transports.File({
        filename: join(config.logDir, `reset-${today}.log`),
        maxsize: config.logMaxSize * 1024 * 1024,
    }));
}

/**
 * 日志工具类
 */
export class Logger {
    /**
     * DEBUG级别日志
     */
    static debug(message, metadata = {}) {
        logger.debug(message, metadata);
    }

    /**
     * INFO级别日志
     */
    static info(message, metadata = {}) {
        logger.info(message, metadata);
    }

    /**
     * WARN级别日志
     */
    static warn(message, metadata = {}) {
        logger.warn(message, metadata);
    }

    /**
     * ERROR级别日志
     */
    static error(message, error = null, metadata = {}) {
        const errorInfo = error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            ...metadata
        } : metadata;

        logger.error(message, errorInfo);
    }

    /**
     * SUCCESS日志（INFO级别，但有特殊标记）
     */
    static success(message, metadata = {}) {
        logger.info(`✅ ${message}`, metadata);
    }

    /**
     * 脱敏API Key（只显示前8位）
     */
    static sanitizeAPIKey(apiKey) {
        if (!apiKey || apiKey.length < 12) {
            return '***';
        }
        return apiKey.substring(0, 8) + '***';
    }

    /**
     * 关闭logger（优雅退出时调用）
     */
    static async end() {
        return new Promise((resolve) => {
            logger.end(resolve);
        });
    }
}

export default Logger;
