# API接口文档

## 📋 目录

- [概述](#概述)
- [基础配置](#基础配置)
- [接口列表](#接口列表)
  - [1. 获取订阅列表](#1-获取订阅列表)
  - [2. 重置额度](#2-重置额度)
  - [3. 获取使用情况](#3-获取使用情况)
- [数据结构](#数据结构)
- [错误处理](#错误处理)
- [速率限制](#速率限制)
- [重试机制](#重试机制)
- [最佳实践](#最佳实践)

---

## 概述

本项目通过调用88code官方API实现自动重置功能。所有API请求都通过`APIClient`类进行封装，内置了重试机制、速率限制和错误处理。

### API基础信息

```
Base URL: https://www.88code.org
API Key格式: 88_xxxxxxxxx (40+字符)
认证方式: Authorization: Bearer {API_KEY}
超时时间: 30秒 (可配置)
```

---

## 基础配置

### 环境变量配置

```env
# API基础URL
API_BASE_URL=https://www.88code.org

# API密钥（多个用逗号分隔）
API_KEYS=88_dd3affd62c13dc5a5bc4a8db68225969ee59f93bcce0e1387e0eecec15e29822

# 请求超时时间（毫秒）
API_TIMEOUT=30000
```

### 代码初始化

```javascript
import APIClient from './core/APIClient.js';

const apiClient = new APIClient({
    apiKey: 'YOUR_API_KEY',
    baseUrl: 'https://www.88code.org',
    timeout: 30000
});
```

---

## 接口列表

### 1. 获取订阅列表

#### 接口信息

```
GET /api/subscriptions
```

#### 请求示例

```javascript
const subscriptions = await apiClient.getSubscriptions();
```

#### 响应示例

```json
[
    {
        "id": 12345,
        "subscriptionPlanName": "FREE",
        "subscriptionPlan": {
            "id": 1,
            "subscriptionName": "FREE",
            "planType": "MONTHLY",
            "creditLimit": 100.0,
            "modelRestriction": "GPT-4o-mini"
        },
        "currentCredits": 68.50,
        "resetTimes": 2,
        "lastCreditReset": "2025-11-06T18:56:00.000Z",
        "isActive": true,
        "startDate": "2025-11-01T00:00:00.000Z",
        "endDate": "2025-11-30T23:59:59.999Z",
        "userId": 67890,
        "createdAt": "2025-11-01T08:30:00.000Z",
        "updatedAt": "2025-11-06T18:56:00.000Z"
    }
]
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 订阅ID（唯一标识） |
| `subscriptionPlanName` | string | 订阅计划名称（FREE/PRO/PAYGO） |
| `subscriptionPlan` | object | 订阅计划详情 |
| `subscriptionPlan.planType` | string | 计划类型（MONTHLY/PAYGO/PAY_PER_USE） |
| `subscriptionPlan.creditLimit` | number | 额度上限 |
| `currentCredits` | number | 当前剩余额度 |
| `resetTimes` | number | 当日剩余重置次数（0-2） |
| `lastCreditReset` | string | 上次重置时间（ISO 8601格式） |
| `isActive` | boolean | 订阅是否激活 |

#### 关键业务规则

```javascript
// 重置次数规则
resetTimes = 2; // 每天刷新为2次（00:00刷新）

// 冷却期规则
const COOLDOWN_PERIOD = 5 * 60 * 60 * 1000; // 5小时
const canReset = (Date.now() - new Date(lastCreditReset).getTime()) >= COOLDOWN_PERIOD;

// 额度计算
const usagePercent = (currentCredits / subscriptionPlan.creditLimit) * 100;
```

---

### 2. 重置额度

#### 接口信息

```
POST /api/subscriptions/{subscriptionId}/reset
```

#### 请求示例

```javascript
const result = await apiClient.resetCredits(12345);
```

#### 请求参数

| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| `subscriptionId` | number | Path | 是 | 订阅ID |

#### 响应示例

**成功响应 (200 OK):**

```json
{
    "success": true,
    "message": "Credits reset successfully",
    "data": {
        "subscriptionId": 12345,
        "beforeCredits": 68.50,
        "afterCredits": 100.0,
        "beforeResetTimes": 2,
        "afterResetTimes": 1,
        "resetAt": "2025-11-06T18:56:00.000Z"
    }
}
```

**失败响应 (400 Bad Request):**

```json
{
    "success": false,
    "message": "Cannot reset: still in cooldown period",
    "error": {
        "code": "COOLDOWN_NOT_PASSED",
        "details": {
            "lastReset": "2025-11-06T18:56:00.000Z",
            "nextResetAvailable": "2025-11-06T23:56:00.000Z",
            "remainingSeconds": 18000
        }
    }
}
```

#### 业务约束

```javascript
// 重置前置条件检查
function canResetCredits(subscription) {
    // 1. 必须有剩余次数
    if (subscription.resetTimes <= 0) {
        return { allowed: false, reason: '今日重置次数已用完' };
    }

    // 2. 冷却期必须已过
    const cooldownPassed = (Date.now() - new Date(subscription.lastCreditReset).getTime())
                           >= COOLDOWN_PERIOD;
    if (!cooldownPassed) {
        return { allowed: false, reason: '冷却期未过，需等待5小时' };
    }

    // 3. 订阅必须激活
    if (!subscription.isActive) {
        return { allowed: false, reason: '订阅未激活' };
    }

    // 4. 禁止PAYGO订阅重置
    if (subscription.subscriptionPlan.planType === 'PAYGO' ||
        subscription.subscriptionPlan.planType === 'PAY_PER_USE') {
        return { allowed: false, reason: 'PAYGO订阅不支持重置' };
    }

    return { allowed: true };
}
```

#### 重置后状态变化

```
重置前:
  currentCredits: 68.50
  resetTimes: 2
  lastCreditReset: "2025-11-06T18:56:00.000Z"

执行重置 ↓

重置后:
  currentCredits: 100.0  (恢复到creditLimit)
  resetTimes: 1          (减1)
  lastCreditReset: "2025-11-06T18:56:01.000Z" (更新为当前时间)
```

---

### 3. 获取使用情况

#### 接口信息

```
GET /api/usage
```

#### 请求示例

```javascript
const usage = await apiClient.getUsage();
```

#### 响应示例

```json
{
    "totalCredits": 100.0,
    "usedCredits": 31.5,
    "remainingCredits": 68.5,
    "resetTimes": 2,
    "lastReset": "2025-11-06T18:56:00.000Z",
    "nextResetAvailable": "2025-11-06T23:56:00.000Z",
    "subscriptions": [
        {
            "id": 12345,
            "name": "FREE",
            "credits": 68.5,
            "limit": 100.0,
            "usage": 31.5
        }
    ]
}
```

#### 用途说明

此接口主要用于：
1. **连接测试** - 验证API Key是否有效
2. **健康检查** - 程序启动时测试API连通性
3. **状态监控** - 实时查看账户额度使用情况

---

## 数据结构

### Subscription对象完整结构

```typescript
interface Subscription {
    // 基础信息
    id: number;                          // 订阅ID
    subscriptionPlanName: string;        // 订阅名称（"FREE"/"PRO"/"PAYGO"）
    subscriptionPlan: SubscriptionPlan;  // 订阅计划详情

    // 额度信息
    currentCredits: number;              // 当前剩余额度
    resetTimes: number;                  // 当日剩余重置次数（0-2）
    lastCreditReset: string;             // 上次重置时间（ISO 8601）

    // 状态信息
    isActive: boolean;                   // 是否激活
    startDate: string;                   // 订阅开始时间
    endDate: string;                     // 订阅结束时间

    // 关联信息
    userId: number;                      // 用户ID
    createdAt: string;                   // 创建时间
    updatedAt: string;                   // 更新时间
}

interface SubscriptionPlan {
    id: number;                          // 计划ID
    subscriptionName: string;            // 计划名称
    planType: string;                    // 计划类型（MONTHLY/PAYGO）
    creditLimit: number;                 // 额度上限
    modelRestriction?: string;           // 模型限制
}
```

### ResetResult结果对象

```typescript
interface ResetResult {
    resetType: 'FIRST' | 'SECOND';       // 重置类型
    startTime: number;                   // 开始时间戳
    endTime: number;                     // 结束时间戳
    totalDuration: number;               // 总耗时（毫秒）

    totalSubscriptions: number;          // 总订阅数
    eligible: number;                    // 符合条件的订阅数
    success: number;                     // 成功次数
    failed: number;                      // 失败次数
    skipped: number;                     // 跳过次数

    details: ResetDetail[];              // 详细结果
    error?: string;                      // 错误信息（如有）
}

interface ResetDetail {
    subscriptionId: number;              // 订阅ID
    subscriptionName: string;            // 订阅名称
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED'; // 状态

    beforeCredits?: number;              // 重置前额度
    afterCredits?: number;               // 重置后额度
    beforeResetTimes?: number;           // 重置前次数
    afterResetTimes?: number;            // 重置后次数

    message: string;                     // 结果消息
    error?: string;                      // 错误详情（如有）
    cooldownEndTime?: string;            // 冷却结束时间（延迟重置用）
}
```

---

## 错误处理

### 常见错误码

| 错误码 | HTTP状态码 | 说明 | 处理建议 |
|--------|-----------|------|---------|
| `INVALID_API_KEY` | 401 | API Key无效或过期 | 检查.env配置，更新API Key |
| `COOLDOWN_NOT_PASSED` | 400 | 冷却期未过 | 等待5小时后重试 |
| `NO_RESET_TIMES` | 400 | 今日重置次数已用完 | 等待次日00:00刷新 |
| `SUBSCRIPTION_NOT_FOUND` | 404 | 订阅不存在 | 检查订阅ID是否正确 |
| `SUBSCRIPTION_INACTIVE` | 400 | 订阅未激活 | 激活订阅后重试 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求过于频繁 | 等待速率限制恢复 |
| `NETWORK_ERROR` | - | 网络连接失败 | 检查网络连接，重试 |

### 错误处理示例

```javascript
try {
    const result = await apiClient.resetCredits(subscriptionId);
    Logger.success(`重置成功: ${result.message}`);
} catch (error) {
    switch (error.code) {
        case 'COOLDOWN_NOT_PASSED':
            Logger.warn(`冷却期未过，还需等待 ${error.details.remainingSeconds}秒`);
            break;

        case 'NO_RESET_TIMES':
            Logger.warn('今日重置次数已用完，请明天再试');
            break;

        case 'RATE_LIMIT_EXCEEDED':
            Logger.error('请求过于频繁，请稍后重试');
            // 自动重试机制会处理
            break;

        case 'INVALID_API_KEY':
            Logger.error('API Key无效，请检查配置');
            process.exit(1);
            break;

        default:
            Logger.error('未知错误', error);
    }
}
```

---

## 速率限制

### 令牌桶算法

本项目使用**令牌桶算法**实现速率限制，防止API请求过快触发88code限流。

```javascript
// 默认配置
const RATE_LIMIT_CONFIG = {
    capacity: 10,        // 令牌桶容量
    refillRate: 10,      // 补充速率（个/分钟）
    refillInterval: 60   // 补充间隔（秒）
};

// 配置方式
// .env文件
ENABLE_RATE_LIMIT=true
RATE_LIMIT_CAPACITY=10
RATE_LIMIT_REFILL_RATE=10
```

### 速率限制原理

```
令牌桶初始状态:
  tokens: 10/10 (满)

每次API请求消耗1个令牌:
  tokens: 9/10

每60秒补充10个令牌:
  tokens: 10/10 (恢复)

如果令牌不足:
  → 等待令牌补充
  → 自动延迟请求
```

### 速率限制日志示例

```
[WARN] 速率限制：令牌不足，等待补充（剩余: 0/10）
[INFO] 令牌补充完成（当前: 10/10）
[INFO] 获取令牌成功（剩余: 9/10）
```

---

## 重试机制

### 指数退避重试

当API请求失败时，自动使用**指数退避算法**进行重试。

```javascript
// 重试配置
const RETRY_CONFIG = {
    maxRetries: 3,          // 最大重试次数
    baseDelay: 1000,        // 基础延迟（毫秒）
    enableRetry: true       // 是否启用重试
};

// 指数退避计算
function calculateDelay(attempt) {
    return RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1);
}

// 延迟序列
attempt 1: 1000ms (1秒)
attempt 2: 2000ms (2秒)
attempt 3: 4000ms (4秒)
```

### 可重试错误类型

```javascript
const RETRYABLE_ERRORS = [
    'NETWORK_ERROR',        // 网络错误
    'TIMEOUT',              // 请求超时
    'RATE_LIMIT_EXCEEDED',  // 速率限制
    'SERVER_ERROR',         // 服务器错误（5xx）
    'ECONNRESET',           // 连接重置
    'ETIMEDOUT'             // 连接超时
];

// 不可重试错误
const NON_RETRYABLE_ERRORS = [
    'INVALID_API_KEY',      // API Key错误
    'COOLDOWN_NOT_PASSED',  // 冷却期未过
    'NO_RESET_TIMES',       // 次数用完
    'SUBSCRIPTION_NOT_FOUND' // 订阅不存在
];
```

### 重试日志示例

```
[ERROR] API请求失败: NETWORK_ERROR
[INFO] 正在重试 (1/3)，等待 1000ms...
[ERROR] API请求失败: NETWORK_ERROR
[INFO] 正在重试 (2/3)，等待 2000ms...
[SUCCESS] API请求成功
```

---

## 最佳实践

### 1. API Key管理

```javascript
// ✅ 推荐：使用环境变量
const apiKey = process.env.API_KEYS.split(',')[0];

// ✅ 推荐：多Key轮询（未来扩展）
const apiKeys = process.env.API_KEYS.split(',');
const apiClients = apiKeys.map(key => new APIClient({ apiKey: key }));

// ❌ 不推荐：硬编码API Key
const apiKey = '88_dd3affd62c13dc5a5bc4a8db68225969ee59f93bcce0e1387e0eecec15e29822';
```

### 2. 错误处理

```javascript
// ✅ 推荐：细粒度错误处理
async function safeResetCredits(subscriptionId) {
    try {
        return await apiClient.resetCredits(subscriptionId);
    } catch (error) {
        if (error.code === 'COOLDOWN_NOT_PASSED') {
            // 处理冷却期错误
            return { status: 'SKIPPED', reason: 'cooldown' };
        } else if (error.code === 'NO_RESET_TIMES') {
            // 处理次数用完错误
            return { status: 'SKIPPED', reason: 'no_times' };
        } else {
            // 记录未知错误
            Logger.error('重置失败', error);
            throw error;
        }
    }
}

// ❌ 不推荐：忽略所有错误
async function unsafeResetCredits(subscriptionId) {
    try {
        return await apiClient.resetCredits(subscriptionId);
    } catch (error) {
        // 忽略错误
    }
}
```

### 3. 请求频率控制

```javascript
// ✅ 推荐：串行处理订阅，避免触发限流
async function processSubscriptions(subscriptions) {
    for (const sub of subscriptions) {
        await processSubscription(sub);
        // 每次处理后延迟1秒
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// ❌ 不推荐：并发处理所有订阅
async function processSubscriptions(subscriptions) {
    await Promise.all(subscriptions.map(sub => processSubscription(sub)));
}
```

### 4. 状态验证

```javascript
// ✅ 推荐：重置后验证结果
async function resetWithVerification(subscriptionId) {
    const before = await apiClient.getSubscriptions();
    const beforeSub = before.find(s => s.id === subscriptionId);

    await apiClient.resetCredits(subscriptionId);

    // 等待3秒让API更新
    await new Promise(resolve => setTimeout(resolve, 3000));

    const after = await apiClient.getSubscriptions();
    const afterSub = after.find(s => s.id === subscriptionId);

    Logger.info(
        `重置验证: ${beforeSub.currentCredits} → ${afterSub.currentCredits}, ` +
        `resetTimes ${beforeSub.resetTimes} → ${afterSub.resetTimes}`
    );
}

// ❌ 不推荐：重置后不验证
async function resetWithoutVerification(subscriptionId) {
    await apiClient.resetCredits(subscriptionId);
    Logger.info('重置完成');
}
```

### 5. 日志记录

```javascript
// ✅ 推荐：结构化日志
Logger.info(`[订阅${subId}] 执行重置`, {
    subscriptionId: subId,
    beforeCredits: before.currentCredits,
    beforeResetTimes: before.resetTimes,
    timestamp: new Date().toISOString()
});

// ❌ 不推荐：非结构化日志
Logger.info('重置订阅');
```

---

## 附录：完整请求示例

### 完整重置流程

```javascript
import APIClient from './core/APIClient.js';
import Logger from './utils/Logger.js';
import TimeUtils from './utils/TimeUtils.js';

async function completeResetFlow() {
    // 1. 初始化API客户端
    const apiClient = new APIClient({
        apiKey: process.env.API_KEYS.split(',')[0],
        baseUrl: process.env.API_BASE_URL,
        timeout: parseInt(process.env.API_TIMEOUT)
    });

    // 2. 测试连接
    const connected = await apiClient.testConnection();
    if (!connected) {
        Logger.error('API连接失败');
        return;
    }
    Logger.success('API连接成功');

    // 3. 获取订阅列表
    const subscriptions = await apiClient.getSubscriptions();
    Logger.info(`获取到 ${subscriptions.length} 个订阅`);

    // 4. 过滤符合条件的订阅
    const eligibleSubscriptions = subscriptions.filter(sub => {
        // PAYGO保护
        if (sub.subscriptionPlan.planType === 'PAYGO') {
            return false;
        }

        // 类型检查
        if (sub.subscriptionPlan.planType !== 'MONTHLY') {
            return false;
        }

        // 激活检查
        if (!sub.isActive) {
            return false;
        }

        // 冷却检查
        const cooldown = TimeUtils.checkCooldown(sub.lastCreditReset);
        if (!cooldown.passed) {
            return false;
        }

        // 次数检查
        if (sub.resetTimes < 1) {
            return false;
        }

        return true;
    });

    Logger.info(`符合条件的订阅: ${eligibleSubscriptions.length} 个`);

    // 5. 逐个重置
    for (const sub of eligibleSubscriptions) {
        try {
            Logger.info(`[订阅${sub.id}] 开始重置...`);

            // 重置前状态
            const beforeCredits = sub.currentCredits;
            const beforeResetTimes = sub.resetTimes;

            // 执行重置
            await apiClient.resetCredits(sub.id);

            // 等待API更新
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 验证结果
            const updated = await apiClient.getSubscriptions();
            const afterSub = updated.find(s => s.id === sub.id);

            Logger.success(
                `[订阅${sub.id}] 重置成功: ` +
                `${beforeCredits.toFixed(2)} → ${afterSub.currentCredits.toFixed(2)} credits, ` +
                `resetTimes ${beforeResetTimes} → ${afterSub.resetTimes}`
            );

        } catch (error) {
            Logger.error(`[订阅${sub.id}] 重置失败`, error);
        }

        // 延迟1秒，避免限流
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    Logger.info('所有重置完成');
}

// 执行
completeResetFlow().catch(error => {
    Logger.error('重置流程失败', error);
    process.exit(1);
});
```

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v1.0.0 | 2025-11-06 | 初始版本，完整API文档 |

---

**文档维护者**: 88code-reset项目团队
**最后更新**: 2025-11-06
