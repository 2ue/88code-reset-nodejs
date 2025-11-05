# 88code 自动重置工具 - 项目架构文档

## 📐 整体架构设计

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         应用层                                │
│                      (src/index.js)                          │
│  - 应用入口                                                   │
│  - 初始化服务                                                 │
│  - 生命周期管理                                               │
│  - 优雅关闭                                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       调度层                                  │
│                   (src/core/Scheduler.js)                    │
│  - 定时任务管理 (node-cron)                                  │
│  - 任务锁控制                                                │
│  - 18:55 首次重置                                            │
│  - 23:56 二次重置                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       业务层                                  │
│                 (src/core/ResetService.js)                   │
│  - 重置逻辑编排                                              │
│  - 订阅过滤 (6层检查)                                        │
│  - 延迟重置调度                                              │
│  - 结果汇总                                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ↓                   ↓
    ┌───────────────────────┐   ┌──────────────────────┐
    │      API通信层         │   │     工具层            │
    │ (src/core/APIClient)   │   │   (src/utils/*)      │
    │  - HTTP客户端          │   │  - Logger            │
    │  - 请求/响应拦截       │   │  - TimeUtils         │
    │  - 速率限制            │   │  - RateLimiter       │
    │  - 重试机制            │   │  - RetryHelper       │
    └───────────────────────┘   └──────────────────────┘
                    │
                    ↓
    ┌───────────────────────────────────────┐
    │         88code API                    │
    │  POST /api/usage                      │
    │  POST /api/subscription               │
    │  POST /api/reset-credits/{id}         │
    └───────────────────────────────────────┘
```

---

## 📁 目录结构

```
88code-reset-nodejs/
├── src/
│   ├── core/                   # 核心业务层
│   │   ├── APIClient.js        # API通信客户端
│   │   ├── ResetService.js     # 重置服务（核心逻辑）
│   │   └── Scheduler.js        # 调度器（定时任务）
│   │
│   ├── utils/                  # 工具层
│   │   ├── Logger.js           # 日志系统 (winston)
│   │   ├── RateLimiter.js      # 速率限制器（令牌桶）
│   │   ├── RetryHelper.js      # 重试助手（指数退避）
│   │   └── TimeUtils.js        # 时间工具类
│   │
│   ├── storage/                # 存储层
│   │   └── FileStorage.js      # 文件存储（历史记录）
│   │
│   ├── config.js               # 配置管理
│   ├── constants.js            # 常量定义
│   └── index.js                # 应用入口
│
├── logs/                       # 日志目录（运行时创建）
│   ├── combined.log            # 所有日志
│   ├── error.log               # 错误日志
│   └── reset-YYYY-MM-DD.log    # 按日期分割
│
├── data/                       # 数据目录（运行时创建）
│   └── reset-YYYY-MM-DD.json   # 重置历史记录
│
├── .env                        # 环境变量配置
├── .env.example                # 配置模板
├── package.json                # 项目依赖
├── README.md                   # 使用说明
├── ARCHITECTURE.md             # 架构文档（本文件）
├── LOGIC_FLOW.md               # 逻辑流程文档
└── DELAYED_RESET.md            # 延迟重置功能说明
```

---

## 🏗️ 分层架构详解

### 1. 应用层 (Application Layer)

**文件:** `src/index.js`

**职责:**
- 应用程序入口
- 服务初始化和依赖注入
- 生命周期管理
- 优雅关闭处理
- 测试模式支持

**核心代码:**
```javascript
async function main() {
    // 1. 测试模式
    if (process.argv.includes('--mode=test') || config.runTestOnStart) {
        await runTest();
    }

    // 2. 初始化服务
    const apiClients = config.apiKeys.map(apiKey => new APIClient(apiKey));
    const resetServices = apiClients.map(client => new ResetService(client));

    // 3. 启动调度器
    scheduler = new Scheduler(resetService);
    await scheduler.start();
}

// 优雅关闭
process.on('SIGTERM', async () => {
    if (scheduler) scheduler.stop();
    await Logger.end();
    process.exit(0);
});
```

---

### 2. 调度层 (Scheduler Layer)

**文件:** `src/core/Scheduler.js`

**职责:**
- 定时任务管理（基于 node-cron）
- 任务执行锁（防止并发）
- 时区支持
- 下次执行时间显示

**核心机制:**

```javascript
class Scheduler {
    constructor(resetService) {
        this.resetService = resetService;
        this.lock = new ExecutionLock();
        this.jobs = [];
    }

    async start() {
        // 首次重置任务 (18:55)
        const firstCron = TimeUtils.toCronExpression(config.firstResetTime);
        const firstJob = cron.schedule(firstCron, () => {
            this.executeWithLock(LOCK_NAMES.FIRST_RESET, RESET_TYPES.FIRST);
        }, { timezone: config.timezone });

        // 二次重置任务 (23:56)
        const secondCron = TimeUtils.toCronExpression(config.secondResetTime);
        const secondJob = cron.schedule(secondCron, () => {
            this.executeWithLock(LOCK_NAMES.SECOND_RESET, RESET_TYPES.SECOND);
        }, { timezone: config.timezone });
    }

    async executeWithLock(lockName, resetType) {
        if (!await this.lock.acquire(lockName)) {
            return; // 已在执行中，跳过
        }

        try {
            await this.resetService.executeReset(resetType);
        } finally {
            this.lock.release(lockName);
        }
    }
}
```

**任务锁机制:**
- 使用 Map 存储锁状态
- 防止同一任务并发执行
- 自动释放锁

---

### 3. 业务层 (Business Layer)

**文件:** `src/core/ResetService.js`

**职责:**
- 核心业务逻辑编排
- 订阅过滤（6层检查）
- 延迟重置调度
- 结果汇总和统计

**核心流程:**

```javascript
class ResetService {
    async executeReset(resetType) {
        // 1. 获取订阅列表
        const subscriptions = await this.apiClient.getSubscriptions();

        // 2. 过滤符合条件的订阅
        const eligible = subscriptions.filter(sub => this.isEligible(sub, resetType));

        // 3. 串行处理订阅
        for (const subscription of eligible) {
            if (resetType === RESET_TYPES.SECOND) {
                // 第二次重置：支持延迟
                await this.processSubscriptionWithDelay(subscription, resetType);
            } else {
                // 首次重置：正常处理
                await this.processSubscription(subscription, resetType);
            }
        }

        // 4. 汇总结果
        return result;
    }
}
```

**6层过滤检查:**

| 优先级 | 检查项 | 说明 |
|--------|--------|------|
| P0 | PAYGO保护 | 四重检查，排除按量付费订阅 |
| P1 | 订阅类型 | planType === 'MONTHLY' |
| P1 | 激活状态 | isActive === true |
| P2 | 冷却检查 | 距离上次重置 ≥ 5小时 |
| P3 | 次数检查 | 首次: resetTimes==2<br>二次: resetTimes≥1 |

---

### 4. API通信层 (API Layer)

**文件:** `src/core/APIClient.js`

**职责:**
- HTTP客户端封装（基于 axios）
- 请求/响应拦截器
- 速率限制集成
- 重试机制集成

**拦截器架构:**

```javascript
class APIClient {
    setupInterceptors() {
        // 请求拦截器
        this.client.interceptors.request.use(async (config) => {
            // 1. 速率限制检查
            await APIClient.rateLimiter.waitForToken();

            // 2. 添加认证头
            config.headers.Authorization = this.apiKey;

            // 3. 记录日志
            Logger.debug(`API请求: ${config.method} ${config.url}`);

            return config;
        });

        // 响应拦截器
        this.client.interceptors.response.use(
            (response) => {
                Logger.debug(`API响应: ${response.status}`);
                return response;
            },
            (error) => {
                // 特殊错误处理
                if (error.response.status === 429) {
                    error.message = 'API限流，请稍后重试';
                }
                return Promise.reject(error);
            }
        );
    }
}
```

**API方法:**
- `getUsage()` - 获取用量信息
- `getSubscriptions()` - 获取订阅列表
- `resetCredits(id)` - 重置指定订阅
- `testConnection()` - 测试连接

---

### 5. 工具层 (Utility Layer)

#### 5.1 Logger (日志系统)

**文件:** `src/utils/Logger.js`

**技术栈:** winston

**特性:**
- 多级别日志 (debug, info, warn, error, success)
- 双输出（控制台 + 文件）
- 日志轮转（按大小和日期）
- API Key 脱敏

**配置:**
```javascript
const logger = winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info =>
            `[${info.timestamp}] [${info.level}] ${info.message}`
        )
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
            filename: 'logs/reset-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: config.logMaxSize + 'm',
            maxFiles: config.logMaxDays + 'd',
        }),
    ],
});
```

---

#### 5.2 RateLimiter (速率限制器)

**文件:** `src/utils/RateLimiter.js`

**算法:** 令牌桶 (Token Bucket)

**参数:**
- 容量: 10个令牌
- 补充速率: 10个/分钟

**实现:**
```javascript
class RateLimiter {
    constructor(capacity, refillRate) {
        this.tokens = capacity;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }

    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = (elapsed / 60000) * this.refillRate;

        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    async waitForToken(maxWaitMs = 60000) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            this.refill();
            if (this.tokens >= 1) {
                this.tokens -= 1;
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return false;
    }
}
```

---

#### 5.3 RetryHelper (重试助手)

**文件:** `src/utils/RetryHelper.js`

**策略:** 指数退避 (Exponential Backoff)

**参数:**
- 最大重试次数: 3次
- 延迟基数: 1秒
- 延迟公式: `baseDelay * 2^attempt`

**重试条件:**
```javascript
static defaultShouldRetry(error) {
    // 重试：网络错误、超时、5xx、429
    if (!error.response) return true;
    if (error.code === 'ECONNABORTED') return true;

    const status = error.response.status;
    if (status >= 500) return true;
    if (status === 429) return true;

    // 不重试：401、403、400
    return false;
}
```

---

#### 5.4 TimeUtils (时间工具)

**文件:** `src/utils/TimeUtils.js`

**核心方法:**

| 方法 | 功能 |
|------|------|
| `checkCooldown()` | 检查5小时冷却期 |
| `formatDuration()` | 格式化时间段 |
| `formatDateTime()` | 格式化日期时间 |
| `parseCronTime()` | 解析时间字符串 |
| `toCronExpression()` | 生成Cron表达式 |
| `getTodayEnd()` | 获取23:59:49时间戳 |
| `getCooldownEndTime()` | 计算冷却结束时间 |

**延迟重置支持:**
```javascript
static getTodayEnd() {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return todayEnd.getTime() - DELAYED_RESET_CONFIG.END_OF_DAY_BUFFER;
}

static getCooldownEndTime(lastResetTimeStr) {
    const lastResetTime = new Date(lastResetTimeStr).getTime();
    return lastResetTime + COOLDOWN_PERIOD;
}
```

---

### 6. 存储层 (Storage Layer)

**文件:** `src/storage/FileStorage.js`

**职责:**
- 持久化重置历史
- 按日期分割文件
- 自动清理过期记录

**存储格式:**
```json
// data/reset-2025-11-06.json
[
  {
    "timestamp": "2025-11-06T10:55:00Z",
    "resetType": "FIRST",
    "totalSubscriptions": 2,
    "success": 2,
    "failed": 0,
    "details": [...]
  }
]
```

---

### 7. 配置层 (Configuration Layer)

#### 7.1 config.js

**职责:**
- 加载环境变量
- 配置验证
- 默认值设置

**配置项分类:**
```javascript
export const config = {
    // API配置
    apiKeys: parseAPIKeys(process.env.API_KEYS),
    apiBaseURL: process.env.API_BASE_URL || 'https://www.88code.org',
    apiTimeout: parseInt(process.env.API_TIMEOUT) || 30000,

    // 重置策略
    firstResetTime: process.env.FIRST_RESET_TIME || '18:55',
    secondResetTime: process.env.SECOND_RESET_TIME || '23:56',
    timezone: process.env.TIMEZONE || 'Asia/Shanghai',

    // 重试配置
    enableRetry: process.env.ENABLE_RETRY !== 'false',
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,

    // 速率限制
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    rateLimitCapacity: parseInt(process.env.RATE_LIMIT_CAPACITY) || 10,

    // 日志配置
    logLevel: process.env.LOG_LEVEL || 'info',
    logFileEnabled: process.env.LOG_FILE_ENABLED !== 'false',
};
```

#### 7.2 constants.js

**职责:**
- 定义系统常量
- API端点
- 订阅类型
- 重置状态

**关键常量:**
```javascript
export const COOLDOWN_PERIOD = 5 * 60 * 60 * 1000; // 5小时

export const DELAYED_RESET_CONFIG = {
    END_OF_DAY_BUFFER: 10 * 1000,  // 10秒缓冲
    DAY_IN_MS: 24 * 60 * 60 * 1000,
};

export const RESET_TYPES = {
    FIRST: 'FIRST',    // 18:55
    SECOND: 'SECOND',  // 23:56
    MANUAL: 'MANUAL',
};
```

---

## 🔄 数据流

### 正常重置流程

```
1. Scheduler (18:55触发)
   ↓
2. ResetService.executeReset(FIRST)
   ↓
3. APIClient.getSubscriptions()
   → 88code API
   ← 订阅列表
   ↓
4. ResetService.isEligible() (过滤)
   → 符合条件的订阅
   ↓
5. ResetService.processSubscription()
   ↓
6. APIClient.resetCredits(id)
   → 88code API
   ← 重置响应
   ↓
7. 验证结果 + 记录日志
   ↓
8. FileStorage.saveResetHistory()
```

### 延迟重置流程

```
1. Scheduler (23:56触发)
   ↓
2. ResetService.executeReset(SECOND)
   ↓
3. ResetService.processSubscriptionWithDelay()
   ↓
4. 检查冷却状态
   ├─ 已过冷却 → 直接重置
   └─ 冷却中 →
      ↓
      计算冷却结束时间
      ↓
      ├─ <= 23:59:49 → 创建延迟定时器
      │   ↓
      │   setTimeout(冷却结束时间)
      │   ↓
      │   执行重置
      │
      └─ > 23:59:49 → 放弃（跨天）
```

---

## 🛡️ 容错机制

### 1. 网络层容错

```
API请求
  ↓
速率限制器 (等待令牌)
  ↓
发送请求
  ├─ 成功 → 返回数据
  └─ 失败 →
      ↓
      重试机制 (指数退避)
      ├─ 第1次: 等待1秒
      ├─ 第2次: 等待2秒
      ├─ 第3次: 等待4秒
      └─ 放弃 → 记录错误日志
```

### 2. 业务层容错

```
订阅列表处理
  ↓
逐个订阅串行处理
  ↓
单个订阅失败
  ├─ 记录错误
  ├─ 继续处理下一个
  └─ 不影响其他订阅
```

### 3. 调度层容错

```
定时任务触发
  ↓
获取任务锁
  ├─ 获取成功 → 执行任务
  └─ 获取失败 → 跳过（已在执行）
      ↓
      任务执行异常
      ├─ 记录错误
      └─ 释放锁
```

---

## 🔒 安全机制

### 1. PAYGO保护（最高优先级）

```javascript
isPAYGO(subscription) {
    return (
        subscriptionPlanName === 'PAYGO' ||
        subscriptionPlan.subscriptionName === 'PAYGO' ||
        subscriptionPlan.planType === 'PAYGO' ||
        subscriptionPlan.planType === 'PAY_PER_USE'
    );
}
```

### 2. API Key 脱敏

```javascript
sanitizeAPIKey(apiKey) {
    if (!apiKey || apiKey.length < 12) return '***';
    return apiKey.substring(0, 8) + '***';
}
```

### 3. 速率限制

- 令牌桶算法
- 10个令牌/分钟
- 防止API限流

### 4. 执行锁

- 防止并发执行
- Map存储锁状态
- 自动释放

---

## 🚀 性能优化

### 1. 串行处理

```javascript
// 避免并发触发限流
for (const subscription of eligibleSubscriptions) {
    await processSubscription(subscription);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒间隔
}
```

### 2. 单例模式

```javascript
// 全局共享速率限制器
if (!APIClient.rateLimiter && config.enableRateLimit) {
    APIClient.rateLimiter = new RateLimiter(10, 10);
}
```

### 3. 延迟重置

```javascript
// 避免冷却期内的无效请求
if (cooldown.passed) {
    // 直接重置
} else {
    // 创建延迟定时器，在冷却结束时执行
}
```

---

## 📊 监控和日志

### 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| DEBUG | 调试信息 | API请求细节 |
| INFO | 一般信息 | 重置执行步骤 |
| WARN | 警告信息 | 冷却中、跳过 |
| ERROR | 错误信息 | API失败、异常 |
| SUCCESS | 成功信息 | 重置成功 |

### 日志输出

```
控制台输出（实时）
  ├─ INFO、WARN、ERROR、SUCCESS
  └─ 彩色显示

文件输出（持久化）
  ├─ combined.log (所有日志)
  ├─ error.log (错误日志)
  └─ reset-YYYY-MM-DD.log (按日期)
```

---

## 🎯 设计原则

### 1. 单一职责原则 (SRP)
- 每个类/模块只负责一个功能
- Logger专注日志，APIClient专注API通信

### 2. 开闭原则 (OCP)
- 对扩展开放，对修改关闭
- 通过配置文件控制行为

### 3. 依赖倒置原则 (DIP)
- 依赖抽象，不依赖具体实现
- 通过构造函数注入依赖

### 4. 接口隔离原则 (ISP)
- 精简的接口设计
- 每个方法职责明确

---

## 📈 扩展性

### 1. 多账号支持

```javascript
// 支持多个API Key
const apiClients = config.apiKeys.map(apiKey => new APIClient(apiKey));
const resetServices = apiClients.map(client => new ResetService(client));
```

### 2. 存储扩展

```javascript
// 可扩展为数据库存储
class DatabaseStorage extends StorageInterface {
    async saveResetHistory(result) {
        // 保存到数据库
    }
}
```

### 3. 通知扩展

```javascript
// 可添加通知功能
class NotificationService {
    async notifyResetSuccess(result) {
        // 发送邮件/Webhook
    }
}
```

---

## ✅ 总结

### 架构特点

1. **分层清晰** - 应用层、调度层、业务层、API层、工具层
2. **职责分离** - 每层专注自己的职责
3. **容错完善** - 网络、业务、调度三层容错
4. **安全可靠** - PAYGO保护、速率限制、执行锁
5. **易于扩展** - 模块化设计，支持多种扩展

### 技术栈

- **运行时**: Node.js 16+
- **调度**: node-cron
- **HTTP**: axios
- **日志**: winston
- **配置**: dotenv

### 核心优势

- ✅ 无脑重置策略 - 确保每天用完2次
- ✅ 智能延迟重置 - 最大化利用机会
- ✅ 完善的容错机制 - 稳定可靠
- ✅ 详细的日志记录 - 可追溯
- ✅ 模块化设计 - 易维护扩展
