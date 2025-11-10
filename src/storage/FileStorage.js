/**
 * 文件存储
 * 持久化执行历史和状态
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import Logger from '../utils/Logger.js';
import config from '../config.js';

export class FileStorage {
    constructor() {
        this.dataDir = config.dataDir;
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            Logger.error('创建数据目录失败', error);
        }
    }

    async saveResetHistory(result) {
        if (!config.enableHistory) return;

        try {
            const filename = `reset-${new Date().toISOString().split('T')[0]}.json`;
            const filepath = join(this.dataDir, filename);

            // 读取现有记录
            let history = [];
            try {
                const content = await fs.readFile(filepath, 'utf-8');
                history = JSON.parse(content);
            } catch {
                // 文件不存在，创建新的
            }

            history.push({
                timestamp: new Date().toISOString(),
                ...result,
            });

            await fs.writeFile(filepath, JSON.stringify(history, null, 2));
            Logger.debug(`保存重置历史: ${filename}`);

        } catch (error) {
            Logger.error('保存重置历史失败', error);
        }
    }

    async cleanOldHistory() {
        if (!config.enableHistory) return;

        try {
            const files = await fs.readdir(this.dataDir);

            // 筛选出历史记录文件
            const historyFiles = [];
            for (const file of files) {
                if (!file.startsWith('reset-') || !file.endsWith('.json')) {
                    continue;
                }

                const filepath = join(this.dataDir, file);
                const stats = await fs.stat(filepath);
                historyFiles.push({
                    name: file,
                    path: filepath,
                    mtime: stats.mtimeMs,
                });
            }

            // 按修改时间降序排序（最新的在前）
            historyFiles.sort((a, b) => b.mtime - a.mtime);

            // 保留最新的 historyMaxDays 个文件，删除其余的
            const maxFiles = config.historyMaxDays;
            const filesToDelete = historyFiles.slice(maxFiles);

            for (const file of filesToDelete) {
                await fs.unlink(file.path);
                Logger.debug(`清理旧历史文件: ${file.name} (保留最新${maxFiles}个)`);
            }

            if (filesToDelete.length > 0) {
                Logger.info(`已清理 ${filesToDelete.length} 个旧历史文件，保留最新 ${Math.min(historyFiles.length, maxFiles)} 个`);
            }
        } catch (error) {
            Logger.error('清理历史文件失败', error);
        }
    }

    async getResetHistory(days = 7) {
        if (!config.enableHistory) return [];

        try {
            const files = await fs.readdir(this.dataDir);
            const historyFiles = files
                .filter(f => f.startsWith('reset-') && f.endsWith('.json'))
                .sort()
                .reverse()
                .slice(0, days);

            const history = [];
            for (const file of historyFiles) {
                const filepath = join(this.dataDir, file);
                const content = await fs.readFile(filepath, 'utf-8');
                const records = JSON.parse(content);
                history.push(...records);
            }

            return history;
        } catch (error) {
            Logger.error('读取历史记录失败', error);
            return [];
        }
    }
}

export default FileStorage;
