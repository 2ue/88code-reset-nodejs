/**
 * 通知器基类
 * 所有通知器都应继承此类
 */

import Logger from '../utils/Logger.js';

export class BaseNotifier {
    constructor(config) {
        this.config = config;
        this.enabled = false;
    }

    /**
     * 初始化通知器
     * 子类应实现此方法来验证配置
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * 发送通知
     * @param {Object} data - 通知数据
     * @returns {Promise<boolean>} 是否发送成功
     */
    async send(data) {
        throw new Error('send() must be implemented by subclass');
    }

    /**
     * 格式化重置结果消息
     * @param {Object} result - 重置结果
     * @returns {string} 格式化后的消息
     */
    formatResetResult(result) {
        const { resetType, success, failed, skipped, scheduled, details } = result;
        const resetTypeName = resetType === 'FIRST' ? '第一次检查点' : '第二次检查点';

        let message = `📊 88code 重置通知\n\n`;
        message += `⏰ 检查点: ${resetTypeName}\n`;
        message += `✅ 成功: ${success}\n`;
        message += `❌ 失败: ${failed}\n`;
        message += `⏭️ 跳过: ${skipped}\n`;

        if (scheduled > 0) {
            message += `⏲️ 已调度: ${scheduled}\n`;
        }

        message += `\n`;

        // 添加详细信息
        if (details && details.length > 0) {
            message += `📝 详细信息:\n`;
            details.forEach((detail, index) => {
                const statusIcon = this.getStatusIcon(detail.status);
                message += `${index + 1}. ${statusIcon} ${detail.subscriptionName}\n`;

                if (detail.status === 'SUCCESS') {
                    message += `   额度: ${detail.beforeCredits?.toFixed(2)} → ${detail.afterCredits?.toFixed(2)}\n`;
                } else if (detail.status === 'SCHEDULED') {
                    message += `   ${detail.message}\n`;
                } else if (detail.message) {
                    message += `   ${detail.message}\n`;
                }
            });
        }

        return message;
    }

    /**
     * 获取状态图标
     */
    getStatusIcon(status) {
        const icons = {
            'SUCCESS': '✅',
            'FAILED': '❌',
            'SKIPPED': '⏭️',
            'SCHEDULED': '⏲️',
        };
        return icons[status] || '❓';
    }

    /**
     * 记录日志
     */
    log(level, message, ...args) {
        const prefix = `[${this.constructor.name}]`;
        Logger[level](`${prefix} ${message}`, ...args);
    }
}

export default BaseNotifier;
