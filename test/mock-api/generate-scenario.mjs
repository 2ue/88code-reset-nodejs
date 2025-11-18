#!/usr/bin/env node
/**
 * 测试场景生成器
 * 根据参数快速生成自定义测试场景
 *
 * 使用方法:
 *   node test/mock-api/generate-scenario.mjs --help
 *   node test/mock-api/generate-scenario.mjs --resetTimes 0,1,2 --planName FREE,PLUS
 *   node test/mock-api/generate-scenario.mjs --template cooldown --count 3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 默认订阅模板
const PLAN_TEMPLATES = {
    FREE: {
        subscriptionPlanId: 10000,
        subscriptionPlanName: "FREE",
        cost: 88,
        billingCycle: "yearly",
        billingCycleDesc: "年付",
        subscriptionPlan: {
            id: 10000,
            subscriptionName: "FREE",
            billingCycle: "yearly",
            cost: 88,
            features: "20 刀额度上限\n每天可重置两次",
            creditLimit: 20.25,
            planType: "MONTHLY"
        }
    },
    PLUS: {
        subscriptionPlanId: 4,
        subscriptionPlanName: "PLUS",
        cost: 198,
        billingCycle: "monthly",
        billingCycleDesc: "月付",
        subscriptionPlan: {
            id: 4,
            subscriptionName: "PLUS",
            billingCycle: "monthly",
            cost: 198,
            features: "40 美元额度上限\n每天一次额度恢复至上限功能",
            creditLimit: 50.25,
            planType: "MONTHLY"
        }
    },
    PAYGO: {
        subscriptionPlanId: 10006,
        subscriptionPlanName: "PAYGO",
        cost: 68,
        billingCycle: "yearly",
        billingCycleDesc: "年付",
        subscriptionPlan: {
            id: 10006,
            subscriptionName: "PAYGO",
            billingCycle: "yearly",
            cost: 68,
            features: "按量付费套餐\n一次性 200 美元余额",
            creditLimit: 200.25,
            planType: "PAY_PER_USE"
        }
    }
};

// 帮助信息
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║          88code 测试场景生成器                                 ║
╚══════════════════════════════════════════════════════════════╝

📝 使用方法:

  node generate-scenario.mjs [选项]

🔧 选项:

  --resetTimes <值>      重置次数（逗号分隔，如: 0,1,2）
  --planName <值>        套餐名称（逗号分隔，如: FREE,PLUS,PAYGO）
  --cooldown            生成冷却期内的订阅
  --expired             生成已过期的订阅
  --count <数量>         生成的订阅数量
  --output <文件>        输出文件路径（默认: test-data.json）
  --save <场景名>        保存为场景文件到scenarios/目录
  --help                显示帮助信息

📚 示例:

  1. 生成resetTimes=0的FREE订阅
     node generate-scenario.mjs --resetTimes 0 --planName FREE

  2. 生成混合场景（resetTimes=0,1,2）
     node generate-scenario.mjs --resetTimes 0,1,2 --planName FREE

  3. 生成3个冷却期内的订阅
     node generate-scenario.mjs --cooldown --count 3

  4. 生成并保存为场景文件
     node generate-scenario.mjs --resetTimes 0 --save my-scenario

🎯 预设模板:

  - FREE   (20刀额度上限，每天2次重置)
  - PLUS   (40刀额度上限，每天1次重置)
  - PAYGO  (按量付费，不参与重置)
`);
}

// 生成订阅
function generateSubscription(options = {}) {
    const {
        id = Math.floor(Math.random() * 100000),
        resetTimes = 2,
        planName = 'FREE',
        cooldown = false,
        expired = false,
        currentCredits = null
    } = options;

    const template = PLAN_TEMPLATES[planName] || PLAN_TEMPLATES.FREE;
    const now = new Date();

    // 计算lastCreditReset
    let lastCreditReset;
    if (cooldown) {
        // 冷却期内：3小时前
        const cooldownDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        lastCreditReset = formatDateTime(cooldownDate);
    } else {
        // 冷却期外：10小时前
        const pastDate = new Date(now.getTime() - 10 * 60 * 60 * 1000);
        lastCreditReset = formatDateTime(pastDate);
    }

    // 计算日期
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let endDate, remainingDays, subscriptionStatus;

    if (expired) {
        endDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        remainingDays = 0;
        subscriptionStatus = "已过期";
    } else {
        endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        remainingDays = 30;
        subscriptionStatus = "活跃中";
    }

    // 计算currentCredits
    const credits = currentCredits !== null ? currentCredits :
        (resetTimes === 0 ? -2.89 : Math.random() * template.subscriptionPlan.creditLimit);

    return {
        resetTimes,
        id,
        employeeId: 30057,
        employeeName: "test_user",
        employeeEmail: "test@example.com",
        currentCredits: parseFloat(credits.toFixed(2)),
        lastCreditUpdate: null,
        ...template,
        startDate: formatDateTime(startDate),
        endDate: formatDateTime(endDate),
        remainingDays,
        subscriptionStatus,
        isActive: !expired,
        autoRenew: false,
        autoResetWhenZero: true,
        lastCreditReset,
        createdBy: null,
        createdAt: formatDateTime(startDate),
        updatedAt: formatDateTime(now)
    };
}

// 格式化日期时间
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 解析命令行参数
function parseArgs(args) {
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        }

        if (arg.startsWith('--')) {
            const key = arg.substring(2);
            const value = args[i + 1];

            if (key === 'cooldown' || key === 'expired') {
                options[key] = true;
            } else if (value && !value.startsWith('--')) {
                options[key] = value;
                i++;
            }
        }
    }

    return options;
}

// 主函数
function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        showHelp();
        process.exit(0);
    }

    const options = parseArgs(args);
    const subscriptions = [];

    // 解析resetTimes
    const resetTimesList = options.resetTimes ?
        options.resetTimes.split(',').map(t => parseInt(t.trim())) : [2];

    // 解析planName
    const planNameList = options.planName ?
        options.planName.split(',').map(p => p.trim()) : ['FREE'];

    // 生成订阅
    const count = parseInt(options.count) || (resetTimesList.length * planNameList.length);
    let idCounter = 35000;

    for (let i = 0; i < count; i++) {
        const resetTimes = resetTimesList[i % resetTimesList.length];
        const planName = planNameList[i % planNameList.length];

        const subscription = generateSubscription({
            id: idCounter++,
            resetTimes,
            planName,
            cooldown: options.cooldown || false,
            expired: options.expired || false
        });

        subscriptions.push(subscription);
    }

    // 输出文件
    const outputFile = options.output || path.join(__dirname, 'test-data.json');
    const jsonContent = JSON.stringify(subscriptions, null, 2);

    fs.writeFileSync(outputFile, jsonContent, 'utf-8');

    console.log('\n✅ 场景生成成功！\n');
    console.log(`📁 输出文件: ${outputFile}`);
    console.log(`📊 订阅数量: ${subscriptions.length}\n`);

    // 显示生成的订阅
    console.log('📋 生成的订阅:\n');
    subscriptions.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.subscriptionPlanName} (id:${sub.id})`);
        console.log(`      - resetTimes: ${sub.resetTimes}`);
        console.log(`      - credits: ${sub.currentCredits}/${sub.subscriptionPlan.creditLimit}`);
        console.log(`      - lastReset: ${sub.lastCreditReset}`);
        console.log(`      - status: ${sub.subscriptionStatus}\n`);
    });

    // 保存为场景文件
    if (options.save) {
        const scenarioFile = path.join(__dirname, 'scenarios', `scenario-${options.save}.json`);
        fs.mkdirSync(path.dirname(scenarioFile), { recursive: true });
        fs.writeFileSync(scenarioFile, jsonContent, 'utf-8');
        console.log(`💾 已保存为场景: scenarios/scenario-${options.save}.json\n`);
    }
}

main();
