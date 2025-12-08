/**
 * 配置管理模块
 * 负责加载和验证环境变量配置
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载.env文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

dotenv.config({ path: join(rootDir, '.env') });

/**
 * 解析API Keys（支持逗号分隔多个）
 */
function parseAPIKeys(keysString) {
    if (!keysString) {
        return [];
    }

    return keysString
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0);
}

/**
 * 验证必填配置
 */
function validateConfig(config) {
    const errors = [];

    if (config.apiKeys.length === 0) {
        errors.push('API_KEYS 不能为空，请在.env文件中配置');
    }

    for (const apiKey of config.apiKeys) {
        if (!apiKey || apiKey.length < 10) {
            errors.push(`API Key格式错误（长度不足）: ${apiKey.substring(0, 10)}...`);
        }
    }

    if (config.apiTimeout < 1000 || config.apiTimeout > 120000) {
        errors.push('API_TIMEOUT 必须在 1000-120000 之间');
    }

    if (config.maxRetries < 0 || config.maxRetries > 10) {
        errors.push('MAX_RETRIES 必须在 0-10 之间');
    }

    if (errors.length > 0) {
        console.error('❌ 配置验证失败:');
        errors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
    }
}

/**
 * 配置对象
 */
export const config = {
    // API配置
    apiKeys: parseAPIKeys(process.env.API_KEYS),
    apiBaseURL: process.env.API_BASE_URL || 'https://www.88code.org',
    apiTimeout: parseInt(process.env.API_TIMEOUT) || 30000,

    // 重置策略
    firstResetTime: process.env.FIRST_RESET_TIME || '18:55',
    secondResetTime: process.env.SECOND_RESET_TIME || '23:55',
    timezone: process.env.TIMEZONE || 'Asia/Shanghai',

    // 冷却期配置（单位：小时）
    cooldownHours: parseInt(process.env.COOLDOWN_HOURS) || 5,

    // 低余额重置配置
    enableLowBalanceReset: process.env.ENABLE_LOW_BALANCE_RESET !== 'false',
    lowBalanceThreshold: parseFloat(process.env.LOW_BALANCE_THRESHOLD) || 1,
    lowBalanceCheckTime: process.env.LOW_BALANCE_CHECK_TIME || '00:01',

    // 测试模式（dry-run）
    dryRun: process.env.DRY_RUN === 'true',

    // 重试配置
    enableRetry: process.env.ENABLE_RETRY !== 'false',
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    retryBaseDelay: parseInt(process.env.RETRY_BASE_DELAY) || 1000,

    // 速率限制
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    rateLimitCapacity: parseInt(process.env.RATE_LIMIT_CAPACITY) || 10,
    rateLimitRefillRate: parseInt(process.env.RATE_LIMIT_REFILL_RATE) || 10,

    // 订阅过滤配置
    excludePlanNames: (process.env.EXCLUDE_PLAN_NAMES || '')
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0),

    // 日志配置
    logLevel: process.env.LOG_LEVEL || 'info',
    logFileEnabled: process.env.LOG_FILE_ENABLED !== 'false',
    logDir: process.env.LOG_DIR || './logs',
    logMaxSize: parseInt(process.env.LOG_MAX_SIZE) || 10,
    logMaxDays: parseInt(process.env.LOG_MAX_DAYS) || 30,
    enableApiRequestLog: process.env.ENABLE_API_REQUEST_LOG === 'true',

    // 存储配置
    dataDir: process.env.DATA_DIR || './data',
    enableHistory: process.env.ENABLE_HISTORY !== 'false',
    historyMaxDays: parseInt(process.env.HISTORY_MAX_DAYS) || 90,

    // 性能调优
    requestIntervalMs: parseInt(process.env.REQUEST_INTERVAL_MS) || 1000,
    resetVerificationWaitMs: parseInt(process.env.RESET_VERIFICATION_WAIT_MS) || 3000,
    rateLimitWaitTimeout: parseInt(process.env.RATE_LIMIT_WAIT_TIMEOUT) || 60000,

    // 高级配置
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === 'true',
    healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT) || 3000,
    runTestOnStart: process.env.RUN_TEST_ON_START !== 'false',

    // 通知配置
    enableLocalFile: process.env.ENABLE_LOCAL_FILE_NOTIFIER === 'true',
    localFileOutputDir: process.env.LOCAL_FILE_NOTIFIER_OUTPUT_DIR || './notifications',
    enableTelegram: process.env.ENABLE_TELEGRAM === 'true',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    enableWeCom: process.env.ENABLE_WECOM === 'true',
    wecomWebhookUrl: process.env.WECOM_WEBHOOK_URL || '',

    // 环境
    nodeEnv: process.env.NODE_ENV || 'production',
    rootDir,
};

// 验证配置
validateConfig(config);

// 验证检查点时间配置
import ConfigValidator from './utils/ConfigValidator.js';
ConfigValidator.validateCheckpointTimes(config.firstResetTime, config.secondResetTime);

// 导出配置
export default config;
