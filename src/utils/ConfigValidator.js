/**
 * 配置验证工具
 * 在应用启动时验证配置的合法性
 */

export class ConfigValidator {
    /**
     * 验证检查点时间配置
     * 确保两个检查点间隔>=5小时,避免冷却期冲突
     *
     * 作用：防止用户配置的两个检查点时间间隔过短，导致第二次检查时
     * 第一次重置的冷却期还未结束，虽然有延迟重置功能兜底，但间隔太短
     * 会导致延迟时间过长，影响用户体验
     *
     * @param {string} firstTime - 第一次检查时间 (HH:MM)
     * @param {string} secondTime - 第二次检查时间 (HH:MM)
     * @throws {Error} 如果间隔不足5小时
     */
    static validateCheckpointTimes(firstTime, secondTime) {
        const first = this.parseTime(firstTime);
        const second = this.parseTime(secondTime);

        // 计算时间间隔（分钟）
        let diffMinutes = (second.hour - first.hour) * 60 + (second.minute - first.minute);

        // 处理跨天情况（例如 23:55 -> 00:05）
        if (diffMinutes < 0) {
            diffMinutes += 24 * 60;
        }

        // 最小间隔：5小时 = 300分钟
        // 有智能延迟重置功能，冷却未满时会自动等待，无需额外缓冲
        const MIN_INTERVAL = 5 * 60;

        if (diffMinutes < MIN_INTERVAL) {
            const error =
                `❌ 检查点时间间隔不足！\n` +
                `  第一次检查: ${firstTime}\n` +
                `  第二次检查: ${secondTime}\n` +
                `  实际间隔: ${diffMinutes}分钟 (${this.formatMinutes(diffMinutes)})\n` +
                `  要求间隔: 至少 ${MIN_INTERVAL}分钟 (5小时)\n\n` +
                `推荐配置组合:\n` +
                `  - 18:55 和 23:55 (间隔 5小时) ✅ 最低要求\n` +
                `  - 18:55 和 23:58 (间隔 5小时3分钟) ✅ 推荐\n` +
                `  - 18:50 和 23:58 (间隔 5小时8分钟) ✅ 更安全`;

            throw new Error(error);
        }

        console.log(
            `✅ 检查点时间验证通过: ${firstTime} -> ${secondTime} ` +
            `(间隔 ${diffMinutes}分钟 / ${this.formatMinutes(diffMinutes)})`
        );
    }

    /**
     * 解析时间字符串为小时和分钟
     *
     * ⚠️ 注意：此方法与 TimeUtils.parseCronTime 功能相同
     * 但因循环依赖问题（config.js → ConfigValidator → TimeUtils → config）
     * 无法直接引用 TimeUtils，因此保留独立实现
     *
     * @param {string} timeStr - 时间字符串 (HH:MM)
     * @returns {{ hour: number, minute: number }}
     * @throws {Error} 如果时间格式无效
     */
    static parseTime(timeStr) {
        const parts = timeStr.split(':');

        if (parts.length !== 2) {
            throw new Error(`无效时间格式: ${timeStr},期望格式: HH:MM`);
        }

        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);

        if (isNaN(hour) || isNaN(minute)) {
            throw new Error(`无效时间格式: ${timeStr},小时和分钟必须是数字`);
        }

        if (hour < 0 || hour > 23) {
            throw new Error(`小时超出范围: ${hour},必须在 0-23 之间`);
        }

        if (minute < 0 || minute > 59) {
            throw new Error(`分钟超出范围: ${minute},必须在 0-59 之间`);
        }

        return { hour, minute };
    }

    /**
     * 格式化分钟数为易读格式
     * @param {number} minutes - 分钟数
     * @returns {string} 格式化字符串 (例如: "5小时3分钟")
     */
    static formatMinutes(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        if (hours > 0 && mins > 0) {
            return `${hours}小时${mins}分钟`;
        } else if (hours > 0) {
            return `${hours}小时`;
        } else {
            return `${mins}分钟`;
        }
    }
}

export default ConfigValidator;
