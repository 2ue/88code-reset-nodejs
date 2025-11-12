/**
 * 企业微信机器人通知器
 * 使用企业微信群机器人 Webhook 发送通知
 */

import axios from 'axios';
import { BaseNotifier } from './BaseNotifier.js';

export class WeComNotifier extends BaseNotifier {
    constructor(config) {
        super(config);
        this.webhookUrl = config.wecomWebhookUrl;
    }

    /**
     * 初始化并验证配置
     */
    async initialize() {
        if (!this.webhookUrl) {
            this.log('warn', '企业微信 Webhook 配置不完整，通知功能已禁用');
            this.enabled = false;
            return false;
        }

        // 验证 webhook URL 格式
        if (!this.webhookUrl.includes('qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
            this.log('error', '企业微信 Webhook URL 格式不正确');
            this.enabled = false;
            return false;
        }

        this.log('info', '企业微信机器人已配置');
        this.enabled = true;
        return true;
    }

    /**
     * 发送企业微信消息
     */
    async send(data) {
        if (!this.enabled) {
            return false;
        }

        try {
            const message = this.formatResetResult(data);

            const response = await axios.post(this.webhookUrl, {
                msgtype: 'markdown',
                markdown: {
                    content: message,
                },
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.data.errcode === 0) {
                this.log('info', '通知发送成功');
                return true;
            } else {
                this.log('error', '通知发送失败', response.data);
                return false;
            }
        } catch (error) {
            this.log('error', '发送企业微信通知失败', error.message);
            return false;
        }
    }

    /**
     * 格式化消息为企业微信 Markdown 格式
     */
    formatResetResult(result) {
        const { resetType, success, failed, skipped, scheduled, details, totalSubscriptions } = result;

        // 处理启动通知
        if (resetType === 'STARTUP') {
            return this.formatStartupMessage(result);
        }

        const resetTypeName = resetType === 'FIRST' ? '第一次检查点' :
                             resetType === 'SECOND' ? '第二次检查点' :
                             resetType.includes('DELAYED') ? '延迟重置' : '重置';

        let message = `## 📊 88code 重置通知\n\n`;
        message += `> ⏰ 检查点: <font color="info">${resetTypeName}</font>\n`;
        message += `> ✅ 成功: <font color="info">${success}</font>\n`;
        message += `> ❌ 失败: <font color="warning">${failed}</font>\n`;
        message += `> ⏭️ 跳过: <font color="comment">${skipped}</font>\n`;

        if (scheduled > 0) {
            message += `> ⏲️ 已调度: <font color="info">${scheduled}</font>\n`;
        }

        message += `\n`;

        // 添加详细信息
        if (details && details.length > 0) {
            message += `### 📝 详细信息\n`;
            details.forEach((detail, index) => {
                const statusIcon = this.getStatusIcon(detail.status);
                const statusColor = this.getStatusColor(detail.status);

                message += `${index + 1}. ${statusIcon} <font color="${statusColor}">${detail.subscriptionName}</font>\n`;

                if (detail.status === 'SUCCESS') {
                    message += `   > 额度: ${detail.beforeCredits?.toFixed(2)} → **${detail.afterCredits?.toFixed(2)}**\n`;
                } else if (detail.status === 'SCHEDULED') {
                    message += `   > ${detail.message}\n`;
                } else if (detail.message) {
                    message += `   > ${detail.message}\n`;
                }
            });
        }

        return message;
    }

    /**
     * 格式化启动通知消息（Markdown格式）
     * @param {Object} result - 启动通知数据
     * @returns {string} 格式化后的消息
     */
    formatStartupMessage(result) {
        const { details, totalSubscriptions } = result;
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', { hour12: false });

        // 按状态分组订阅
        const activeSubscriptions = details.filter(d => d.subscriptionStatus === '活跃中');
        const inactiveSubscriptions = details.filter(d => d.subscriptionStatus !== '活跃中');

        let message = `## 🚀 88code 服务启动成功\n\n`;
        message += `> ⏰ 启动时间: <font color="info">${timeStr}</font>\n`;
        message += `> 📊 订阅总数: <font color="info">${totalSubscriptions}</font>\n\n`;

        // 活跃中订阅
        if (activeSubscriptions.length > 0) {
            message += `### 📊 活跃中订阅\n`;
            activeSubscriptions.forEach((detail, index) => {
                message += `${index + 1}. ${detail.subscriptionName}\n`;
                if (detail.message) {
                    message += `   > ${detail.message}\n`;
                }
            });
        }

        // 已过期订阅
        if (inactiveSubscriptions.length > 0) {
            message += `\n### ⏸️ 已过期订阅\n`;
            inactiveSubscriptions.forEach((detail, index) => {
                message += `${activeSubscriptions.length + index + 1}. ${detail.subscriptionName}\n`;
                if (detail.message) {
                    message += `   > ${detail.message}\n`;
                }
            });
        }

        return message;
    }

    /**
     * 获取状态颜色
     */
    getStatusColor(status) {
        const colors = {
            'SUCCESS': 'info',      // 绿色
            'FAILED': 'warning',    // 红色
            'SKIPPED': 'comment',   // 灰色
            'SCHEDULED': 'info',    // 蓝色
        };
        return colors[status] || 'comment';
    }
}

export default WeComNotifier;
