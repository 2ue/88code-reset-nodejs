/**
 * 本地文件通知器
 * 将通知写入本地文件，用于测试和调试
 */

import fs from 'fs/promises';
import path from 'path';
import { BaseNotifier } from './BaseNotifier.js';
import TimeUtils from '../utils/TimeUtils.js';

export class LocalFileNotifier extends BaseNotifier {
    constructor(config) {
        super(config);
        this.outputDir = config.localFileOutputDir || './notifications';
        this.outputFile = null;
    }

    /**
     * 初始化并验证配置
     */
    async initialize() {
        try {
            // 创建输出目录
            await fs.mkdir(this.outputDir, { recursive: true });

            // 生成输出文件名（包含时间戳）
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.outputFile = path.join(this.outputDir, `notification-${timestamp}.txt`);

            this.log('info', `本地文件通知器已初始化，输出文件: ${this.outputFile}`);
            this.enabled = true;
            return true;
        } catch (error) {
            this.log('error', '本地文件通知器初始化失败', error);
            this.enabled = false;
            return false;
        }
    }

    /**
     * 发送通知（写入文件）
     */
    async send(data) {
        if (!this.enabled) {
            return false;
        }

        try {
            const message = this.formatResetResult(data);
            const timestamp = TimeUtils.formatDateTime(Date.now());

            const output = `
${'='.repeat(80)}
时间: ${timestamp}
类型: ${data.resetType}
${'='.repeat(80)}

${message}

`;

            // 追加写入文件
            await fs.appendFile(this.outputFile, output, 'utf-8');

            this.log('info', `通知已写入文件: ${this.outputFile}`);
            console.log(`\n📝 通知已写入: ${this.outputFile}\n`);
            return true;
        } catch (error) {
            this.log('error', '写入通知文件失败', error.message);
            return false;
        }
    }

    /**
     * 格式化消息（纯文本格式，不使用HTML）
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

        let message = `📊 88code 重置通知\n\n`;
        message += `⏰ 检查点: ${resetTypeName}\n`;
        if (apiKeyMask) {
            message += `🔑 API Key: ${apiKeyMask}\n`;
        }
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
     * 格式化启动通知消息
     */
    formatStartupMessage(result) {
        const { details, totalSubscriptions } = result;
        const timeStr = TimeUtils.formatDateTime(TimeUtils.nowInApiTimezone());

        // 按状态分组订阅
        const activeSubscriptions = details.filter(d => d.subscriptionStatus === '活跃中');
        const inactiveSubscriptions = details.filter(d => d.subscriptionStatus !== '活跃中');

        let message = `🚀 88code 服务启动成功\n\n`;
        message += `⏰ 启动时间: ${timeStr}\n`;
        message += `📊 订阅总数: ${totalSubscriptions}\n\n`;

        // 活跃中订阅
        if (activeSubscriptions.length > 0) {
            message += `📊 活跃中订阅:\n`;
            activeSubscriptions.forEach((detail, index) => {
                message += `${index + 1}. ${detail.subscriptionName}\n`;
                if (detail.message) {
                    message += `   ${detail.message}\n`;
                }
            });
        }

        // 已过期订阅
        if (inactiveSubscriptions.length > 0) {
            message += `\n⏸️ 已过期订阅:\n`;
            inactiveSubscriptions.forEach((detail, index) => {
                message += `${activeSubscriptions.length + index + 1}. ${detail.subscriptionName}\n`;
                if (detail.message) {
                    message += `   ${detail.message}\n`;
                }
            });
        }

        return message;
    }
}

export default LocalFileNotifier;
