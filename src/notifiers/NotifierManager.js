/**
 * 通知管理器
 * 统一管理所有通知器，支持可插拔设计
 */

import Logger from '../utils/Logger.js';
import { TelegramNotifier } from './TelegramNotifier.js';
import { WeComNotifier } from './WeComNotifier.js';
import { LocalFileNotifier } from './LocalFileNotifier.js';

export class NotifierManager {
    constructor(config) {
        this.config = config;
        this.notifiers = [];
    }

    /**
     * 初始化所有通知器
     */
    async initialize() {
        Logger.info('初始化通知模块...');

        // 初始化本地文件通知器
        if (this.config.enableLocalFile) {
            const localFile = new LocalFileNotifier({
                localFileOutputDir: this.config.localFileOutputDir,
            });

            const initialized = await localFile.initialize();
            if (initialized) {
                this.notifiers.push(localFile);
                Logger.info('本地文件通知器已启用');
            }
        }

        // 初始化 Telegram 通知器
        if (this.config.enableTelegram) {
            const telegram = new TelegramNotifier({
                telegramBotToken: this.config.telegramBotToken,
                telegramChatId: this.config.telegramChatId,
            });

            const initialized = await telegram.initialize();
            if (initialized) {
                this.notifiers.push(telegram);
                Logger.info('Telegram通知器已启用');
            }
        }

        // 初始化企业微信通知器
        if (this.config.enableWeCom) {
            const weCom = new WeComNotifier({
                wecomWebhookUrl: this.config.wecomWebhookUrl,
            });

            const initialized = await weCom.initialize();
            if (initialized) {
                this.notifiers.push(weCom);
                Logger.info('企业微信通知器已启用');
            }
        }

        if (this.notifiers.length === 0) {
            Logger.info('未配置任何通知器，通知功能已禁用');
        } else {
            Logger.info(`已启用 ${this.notifiers.length} 个通知器`);
        }
    }

    /**
     * 发送通知到所有已启用的通知器
     * @param {Object} data - 通知数据
     */
    async notify(data) {
        if (this.notifiers.length === 0) {
            return;
        }

        Logger.info('发送重置通知...');

        // 并行发送到所有通知器
        const promises = this.notifiers.map(notifier =>
            notifier.send(data).catch(error => {
                Logger.error(`通知发送失败: ${notifier.constructor.name}`, error);
                return false;
            })
        );

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r === true).length;

        Logger.info(`通知发送完成: ${successCount}/${this.notifiers.length} 成功`);
    }

    /**
     * 获取已启用的通知器数量
     */
    getEnabledCount() {
        return this.notifiers.length;
    }

    /**
     * 检查是否有任何通知器已启用
     */
    isEnabled() {
        return this.notifiers.length > 0;
    }
}

export default NotifierManager;
