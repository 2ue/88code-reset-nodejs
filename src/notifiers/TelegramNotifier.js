/**
 * Telegram 通知器
 * 使用 Telegram Bot API 发送通知
 */

import axios from 'axios';
import { BaseNotifier } from './BaseNotifier.js';
import TimeUtils from '../utils/TimeUtils.js';

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
            // 详细的错误诊断
            const errorCode = error.code;
            const errorMessage = error.message;

            if (errorCode === 'ECONNABORTED' || errorMessage.includes('timeout')) {
                this.log('error', `Telegram 初始化失败: 连接超时 (${error.message})`);
                this.log('warn', '💡 提示: 无法连接到 api.telegram.org，请检查:');
                this.log('warn', '  1. 网络连接是否正常');
                this.log('warn', '  2. 是否需要配置代理（国内环境）');
                this.log('warn', '  3. 防火墙是否阻止了连接');
            } else if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') {
                this.log('error', `Telegram 初始化失败: DNS 解析失败 (${error.message})`);
                this.log('warn', '💡 提示: 无法解析 api.telegram.org 域名，请检查 DNS 配置');
            } else if (errorCode === 'ECONNREFUSED') {
                this.log('error', `Telegram 初始化失败: 连接被拒绝 (${error.message})`);
                this.log('warn', '💡 提示: Telegram API 服务不可达，可能是代理配置问题');
            } else if (error.response) {
                // HTTP 错误响应
                this.log('error', `Telegram 初始化失败: HTTP ${error.response.status} - ${error.response.statusText}`);
                if (error.response.status === 401) {
                    this.log('warn', '💡 提示: Bot Token 无效或已过期，请检查 TELEGRAM_BOT_TOKEN 配置');
                }
            } else {
                this.log('error', `Telegram 初始化失败: ${error.message}`);
            }

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
        const { resetType, apiKeyMask, success, failed, skipped, scheduled, details, totalSubscriptions } = result;

        // 处理启动通知
        if (resetType === 'STARTUP') {
            return this.formatStartupMessage(result);
        }

        const resetTypeName = resetType === 'FIRST' ? '第一次检查点' :
                             resetType === 'SECOND' ? '第二次检查点' :
                             resetType.includes('DELAYED') ? '延迟重置' : '重置';

        let message = `<b>📊 88code 重置通知</b>\n\n`;
        message += `⏰ 检查点: <b>${resetTypeName}</b>\n`;
        if (apiKeyMask) {
            message += `🔑 API Key: <code>${this.escapeHtml(apiKeyMask)}</code>\n`;
        }
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
     * 格式化启动通知消息（HTML格式）
     * @param {Object} result - 启动通知数据
     * @returns {string} 格式化后的消息
     */
    formatStartupMessage(result) {
        const { details, totalSubscriptions } = result;
        const timeStr = TimeUtils.formatDateTime(TimeUtils.nowInApiTimezone());

        // 按状态分组订阅
        const activeSubscriptions = details.filter(d => d.subscriptionStatus === '活跃中');
        const inactiveSubscriptions = details.filter(d => d.subscriptionStatus !== '活跃中');

        let message = `<b>🚀 88code 服务启动成功</b>\n\n`;
        message += `⏰ 启动时间: <b>${timeStr}</b>\n`;
        message += `📊 订阅总数: <b>${totalSubscriptions}</b>\n\n`;

        // 活跃中订阅
        if (activeSubscriptions.length > 0) {
            message += `<b>📊 活跃中订阅:</b>\n`;
            activeSubscriptions.forEach((detail, index) => {
                message += `${index + 1}. ${this.escapeHtml(detail.subscriptionName)}\n`;
                if (detail.message) {
                    message += `   ${this.escapeHtml(detail.message)}\n`;
                }
            });
        }

        // 已过期订阅
        if (inactiveSubscriptions.length > 0) {
            message += `\n<b>⏸️ 已过期订阅:</b>\n`;
            inactiveSubscriptions.forEach((detail, index) => {
                message += `${activeSubscriptions.length + index + 1}. ${this.escapeHtml(detail.subscriptionName)}\n`;
                if (detail.message) {
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
