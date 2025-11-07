#!/usr/bin/env node
/**
 * 命令行入口
 * 支持单次重置执行（用于 GitHub Actions）
 */

import Logger from './utils/Logger.js';
import APIClient from './core/APIClient.js';
import ResetService from './core/ResetService.js';
import StateManager from './utils/StateManager.js';
import config from './config.js';
import { RESET_TYPES } from './constants.js';

/**
 * 解析命令行参数
 */
function parseArgs() {
    const args = {
        type: null,      // FIRST | SECOND
        force: false,    // 强制执行（跳过幂等性检查）
        dryRun: false,   // 空运行
        showStats: false // 显示统计
    };

    for (const arg of process.argv.slice(2)) {
        if (arg === '--type=first' || arg === '--first') {
            args.type = RESET_TYPES.FIRST;
        } else if (arg === '--type=second' || arg === '--second') {
            args.type = RESET_TYPES.SECOND;
        } else if (arg === '--force') {
            args.force = true;
        } else if (arg === '--dry-run') {
            args.dryRun = true;
        } else if (arg === '--stats') {
            args.showStats = true;
        } else if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        }
    }

    return args;
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(`
88code 自动重置工具 - 命令行模式

用法：
  node src/cli.js [选项]

选项：
  --first, --type=first    执行第一次检查点重置
  --second, --type=second  执行第二次检查点重置
  --force                  强制执行（跳过幂等性检查）
  --dry-run                空运行（不实际执行重置）
  --stats                  显示执行统计
  -h, --help               显示帮助信息

示例：
  # 执行第一次检查点重置（带幂等性检查）
  node src/cli.js --first

  # 强制执行第二次检查点重置
  node src/cli.js --second --force

  # 查看统计信息
  node src/cli.js --stats
    `);
}

/**
 * 显示执行统计
 */
async function showStats() {
    await StateManager.init();
    const stats = StateManager.getExecutionStats();

    Logger.info('========== 执行统计 ==========');
    Logger.info(`今日执行状态:`);
    Logger.info(`  - 第一次检查: ${stats.today.first ? '✅ 已执行' : '⏸️ 未执行'}`);
    Logger.info(`  - 第二次检查: ${stats.today.second ? '✅ 已执行' : '⏸️ 未执行'}`);
    Logger.info(`最后执行日期: ${stats.lastExecutionDate || '无'}`);
    Logger.info(`历史执行次数: ${stats.totalExecutions}`);
    Logger.info(`最近24小时失败: ${stats.failures}`);
    Logger.info(`历史失败次数: ${stats.totalFailures}`);
    Logger.info('============================');
}

/**
 * 单次重置执行
 */
async function executeOnce(resetType, options = {}) {
    try {
        Logger.info('========================================');
        Logger.info(`  88code 单次重置执行 (${resetType})`);
        Logger.info('========================================');

        // 初始化状态管理器
        await StateManager.init();

        // 幂等性检查
        if (!options.force && !options.dryRun) {
            const hasExecuted = await StateManager.hasExecutedToday(resetType);
            if (hasExecuted) {
                Logger.warn(`⏭️ 今天已执行过${resetType}重置，跳过执行`);
                Logger.info('如需强制执行，请使用 --force 参数');
                return { skipped: true, reason: 'already_executed_today' };
            }
        }

        // 检查最近失败次数
        const recentFailures = StateManager.getRecentFailureCount(24);
        if (recentFailures >= 3 && !options.force) {
            Logger.error(`⚠️ 最近24小时失败次数过多(${recentFailures})，跳过执行`);
            Logger.info('请检查日志并手动修复问题后使用 --force 重试');
            return { skipped: true, reason: 'too_many_failures' };
        }

        // 空运行模式
        if (options.dryRun) {
            Logger.info('🔍 空运行模式，不会实际执行重置');
        }

        // 初始化服务
        const apiClients = config.apiKeys.map(apiKey => new APIClient(apiKey));
        const resetServices = apiClients.map(client => new ResetService(client));

        // 执行重置
        const results = [];
        let successCount = 0;
        let failureCount = 0;

        for (const service of resetServices) {
            if (options.dryRun) {
                Logger.info('📝 空运行: 跳过实际重置操作');
                results.push({ success: true, dryRun: true });
                continue;
            }

            try {
                const result = await service.executeReset(resetType);
                results.push(result);

                // 统计结果
                if (result.summary) {
                    successCount += result.summary.success || 0;
                    failureCount += result.summary.failure || 0;
                }
            } catch (error) {
                Logger.error(`重置执行失败: ${error.message}`);
                results.push({ success: false, error: error.message });
                failureCount++;
            }
        }

        // 记录执行结果
        if (!options.dryRun) {
            if (failureCount === 0) {
                await StateManager.recordSuccess(resetType, {
                    successCount,
                    failureCount,
                    totalAccounts: config.apiKeys.length
                });
                Logger.success(`✅ ${resetType}重置执行成功`);
            } else {
                await StateManager.recordFailure(resetType, new Error(
                    `部分失败: ${successCount}成功, ${failureCount}失败`
                ));
                Logger.warn(`⚠️ ${resetType}重置部分失败: ${successCount}成功, ${failureCount}失败`);
            }
        }

        Logger.info('========================================');

        return {
            success: failureCount === 0,
            results,
            summary: { successCount, failureCount }
        };

    } catch (error) {
        Logger.error('执行失败', error);

        // 记录失败
        if (!options.dryRun) {
            await StateManager.recordFailure(resetType, error);
        }

        throw error;
    }
}

/**
 * 主函数
 */
async function main() {
    try {
        const args = parseArgs();

        // 显示统计
        if (args.showStats) {
            await showStats();
            return;
        }

        // 检查重置类型
        if (!args.type) {
            Logger.error('❌ 请指定重置类型: --first 或 --second');
            Logger.info('使用 --help 查看帮助信息');
            process.exit(1);
        }

        // 执行重置
        const result = await executeOnce(args.type, {
            force: args.force,
            dryRun: args.dryRun
        });

        // 退出码
        if (result.skipped) {
            process.exit(0); // 跳过也算成功
        } else if (result.success) {
            process.exit(0);
        } else {
            process.exit(1);
        }

    } catch (error) {
        Logger.error('执行失败', error);
        process.exit(1);
    }
}

// 启动
main();
