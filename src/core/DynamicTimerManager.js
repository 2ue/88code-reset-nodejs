/**
 * 动态定时器管理器
 * 统一管理延迟重置定时器,支持批量清理
 */

import Logger from '../utils/Logger.js';

export class DynamicTimerManager {
    constructor() {
        // 存储定时器映射: name -> timerId
        this.timers = new Map();
    }

    /**
     * 设置定时器
     * 自动清除同名的旧定时器(避免重复)
     *
     * @param {string} name - 定时器名称(唯一标识)
     * @param {NodeJS.Timeout} timer - 定时器对象
     */
    set(name, timer) {
        // 清除同名旧定时器
        this.clear(name);

        this.timers.set(name, timer);
        Logger.debug(`⏰ 定时器已设置: ${name}`);
    }

    /**
     * 清除指定定时器
     *
     * @param {string} name - 定时器名称
     */
    clear(name) {
        if (this.timers.has(name)) {
            const timer = this.timers.get(name);
            clearTimeout(timer);
            this.timers.delete(name);
            Logger.debug(`🗑️  定时器已清除: ${name}`);
        }
    }

    /**
     * 清除所有定时器
     * 用于程序关闭时的清理工作
     */
    clearAll() {
        for (const [name, timer] of this.timers.entries()) {
            clearTimeout(timer);
            Logger.debug(`🗑️  定时器已清除: ${name}`);
        }
        this.timers.clear();
        Logger.info('✅ 所有定时器已清除');
    }

    /**
     * 获取当前定时器数量
     * @returns {number}
     */
    getCount() {
        return this.timers.size;
    }

    /**
     * 检查指定定时器是否存在
     * @param {string} name - 定时器名称
     * @returns {boolean}
     */
    has(name) {
        return this.timers.has(name);
    }
}

export default DynamicTimerManager;
