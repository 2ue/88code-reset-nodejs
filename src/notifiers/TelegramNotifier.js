/**
 * Telegram 通知器
 * 使用 Telegram Bot API 发送通知
 */

import axios from 'axios';
import { BaseNotifier } from './BaseNotifier.js';

export class TelegramNotifier extends BaseNotifier {
    constructor(config) {
        super(config);
        this.botToken = config.telegramBotToken;
        this.chatId = config.telegramChatId;
        this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    }

    /**
     * 初始化并验证配置
     */
    async initialize() {
        if (!this.botToken || !this.chatId) {
            this.log('warn', 'Telegram 配置不完整，通知功能已禁用');
            this.enabled = false;
            return false;
        }

        try {
            // 验证 bot token 是否有效
            const response = await axios.get(`${this.apiUrl}/getMe`, {
                timeout: 5000,
            });

            if (response.data.ok) {
                this.log('info', `Telegram Bot 已连接: @${response.data.result.username}`);
                this.enabled = true;
                return true;
            } else {
                this.log('error', 'Telegram Bot Token 无效');
                this.enabled = false;
                return false;
            }
        } catch (error) {
            this.log('error', 'Telegram 初始化失败', error.message);
            this.enabled = false;
            return false;
        }
    }

    /**
     * 发送 Telegram 消息
     */
    async send(data) {
        if (!this.enabled) {
            return false;
        }

        try {
            const message = this.formatResetResult(data);

            const response = await axios.post(`${this.apiUrl}/sendMessage`, {
                chat_id: this.chatId,
                text: message,
                parse_mode: 'HTML',
            }, {
                timeout: 10000,
            });

            if (response.data.ok) {
                this.log('info', '通知发送成功');
                return true;
            } else {
                this.log('error', '通知发送失败', response.data);
                return false;
            }
        } catch (error) {
            this.log('error', '发送 Telegram 通知失败', error.message);
            return false;
        }
    }

    /**
     * 格式化消息为 Telegram HTML 格式
     */
    formatResetResult(result) {
        const { resetType, success, failed, skipped, scheduled, details, totalSubscriptions } = result;

        // 处理启动通知
        if (resetType === 'STARTUP') {
            const now = new Date();
            const timeStr = now.toLocaleString('zh-CN', { hour12: false });

            let message = `<b>🚀 88code 服务启动成功</b>\n\n`;
            message += `⏰ 启动时间: <b>${timeStr}</b>\n`;
            message += `📊 订阅总数: <b>${totalSubscriptions}</b>\n`;
            message += `\n`;

            if (details && details.length > 0) {
                message += `<b>📝 订阅状态:</b>\n`;
                details.forEach((detail, index) => {
                    message += `${index + 1}. ${this.escapeHtml(detail.subscriptionName)}\n`;
                    if (detail.message) {
                        message += `   ${this.escapeHtml(detail.message)}\n`;
                    }
                });
            }

            return message;
        }

        const resetTypeName = resetType === 'FIRST' ? '第一次检查点' :
                             resetType === 'SECOND' ? '第二次检查点' :
                             resetType.includes('DELAYED') ? '延迟重置' : '重置';

        let message = `<b>📊 88code 重置通知</b>\n\n`;
        message += `⏰ 检查点: <b>${resetTypeName}</b>\n`;
        message += `✅ 成功: <b>${success}</b>\n`;
        message += `❌ 失败: <b>${failed}</b>\n`;
        message += `⏭️ 跳过: <b>${skipped}</b>\n`;

        if (scheduled > 0) {
            message += `⏲️ 已调度: <b>${scheduled}</b>\n`;
        }

        message += `\n`;

        // 添加详细信息
        if (details && details.length > 0) {
            message += `<b>📝 详细信息:</b>\n`;
            details.forEach((detail, index) => {
                const statusIcon = this.getStatusIcon(detail.status);
                message += `${index + 1}. ${statusIcon} ${this.escapeHtml(detail.subscriptionName)}\n`;

                if (detail.status === 'SUCCESS') {
                    message += `   额度: ${detail.beforeCredits?.toFixed(2)} → <b>${detail.afterCredits?.toFixed(2)}</b>\n`;
                } else if (detail.status === 'SCHEDULED') {
                    message += `   ${this.escapeHtml(detail.message)}\n`;
                } else if (detail.message) {
                    message += `   ${this.escapeHtml(detail.message)}\n`;
                }
            });
        }

        return message;
    }

    /**
     * 转义 HTML 特殊字符
     */
    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}

export default TelegramNotifier;
