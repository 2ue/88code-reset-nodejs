/**
 * 时间工具类
 * 处理时间相关的计算和格式化
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { COOLDOWN_PERIOD } from '../constants.js';
import config from '../config.js';

// 扩展 dayjs 时区支持
dayjs.extend(utc);
dayjs.extend(timezone);

export class TimeUtils {
    /**
     * 检查冷却期是否已过
     * @param {string} lastResetTimeStr - 上次重置时间字符串
     * @returns {Object} { passed: boolean, remaining: number, formatted: string }
     */
    static checkCooldown(lastResetTimeStr) {
        if (!lastResetTimeStr) {
            return {
                passed: true,
                remaining: 0,
                formatted: '无需等待',
            };
        }

        try {
            const lastResetTime = new Date(lastResetTimeStr).getTime();

            if (isNaN(lastResetTime)) {
                // 解析失败，假设已过冷却期
                return {
                    passed: true,
                    remaining: 0,
                    formatted: '无法解析时间',
                };
            }

            const now = Date.now();
            const elapsed = now - lastResetTime;

            if (elapsed >= COOLDOWN_PERIOD) {
                return {
                    passed: true,
                    remaining: 0,
                    formatted: '已过冷却期',
                };
            }

            const remaining = COOLDOWN_PERIOD - elapsed;

            return {
                passed: false,
                remaining,
                formatted: TimeUtils.formatDuration(remaining),
            };

        } catch (error) {
            // 容错：假设已过冷却期
            return {
                passed: true,
                remaining: 0,
                formatted: '解析异常',
            };
        }
    }

    /**
     * 格式化时间段（毫秒 -> 小时分钟秒）
     * @param {number} ms - 毫秒数
     * @returns {string} 格式化字符串
     */
    static formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return `${hours}小时${remainingMinutes}分钟`;
        } else if (minutes > 0) {
            const remainingSeconds = seconds % 60;
            return `${minutes}分钟${remainingSeconds}秒`;
        } else {
            return `${seconds}秒`;
        }
    }

    /**
     * 格式化日期时间（使用配置的时区）
     * @param {Date|number|string} dateInput - 日期输入
     * @returns {string} 格式化字符串
     */
    static formatDateTime(dateInput) {
        try {
            const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

            if (isNaN(date.getTime())) {
                return '无效日期';
            }

            return date.toLocaleString('zh-CN', {
                timeZone: config.timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
        } catch (error) {
            return '格式化失败';
        }
    }

    /**
     * 获取今天的日期字符串（YYYY-MM-DD）
     * 使用配置的时区
     * @returns {string}
     */
    static getTodayDateString() {
        return dayjs().tz(config.timezone).format('YYYY-MM-DD');
    }

    /**
     * 解析Cron时间字符串到小时和分钟
     *
     * ⚠️ 注意：此方法与 ConfigValidator.parseTime 功能相同
     * 但因循环依赖问题（config.js → ConfigValidator → TimeUtils → config）
     * 两处保留独立实现
     *
     * @param {string} timeStr - 时间字符串（HH:MM）
     * @returns {Object} { hour: number, minute: number }
     */
    static parseCronTime(timeStr) {
        const [hourStr, minuteStr] = timeStr.split(':');
        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);

        if (isNaN(hour) || isNaN(minute)) {
            throw new Error(`无效的时间格式: ${timeStr}`);
        }

        if (hour < 0 || hour > 23) {
            throw new Error(`小时超出范围: ${hour}`);
        }

        if (minute < 0 || minute > 59) {
            throw new Error(`分钟超出范围: ${minute}`);
        }

        return { hour, minute };
    }

    /**
     * 生成Cron表达式
     * @param {string} timeStr - 时间字符串（HH:MM）
     * @returns {string} Cron表达式
     */
    static toCronExpression(timeStr) {
        const { hour, minute } = TimeUtils.parseCronTime(timeStr);
        return `${minute} ${hour} * * *`;
    }

    /**
     * 计算距离下次执行的时间
     * 使用配置的时区进行计算
     * @param {string} timeStr - 时间字符串（HH:MM）
     * @returns {number} 毫秒数
     */
    static getMillisUntilNext(timeStr) {
        const { hour, minute } = TimeUtils.parseCronTime(timeStr);
        const now = dayjs().tz(config.timezone);

        // 在配置时区中设置目标时间
        let next = now.hour(hour).minute(minute).second(0).millisecond(0);

        // 如果今天的时间已过，设置为明天
        if (next.isBefore(now) || next.isSame(now)) {
            next = next.add(1, 'day');
        }

        return next.valueOf() - now.valueOf();
    }

    /**
     * 计算冷却结束时间
     * @param {string} lastResetTimeStr - 上次重置时间字符串
     * @returns {number} 冷却结束时间戳（毫秒），如果无法解析返回0
     */
    static getCooldownEndTime(lastResetTimeStr) {
        if (!lastResetTimeStr) {
            return 0;
        }

        try {
            const lastResetTime = new Date(lastResetTimeStr).getTime();

            if (isNaN(lastResetTime)) {
                return 0;
            }

            return lastResetTime + COOLDOWN_PERIOD;
        } catch (error) {
            return 0;
        }
    }
}

export default TimeUtils;
