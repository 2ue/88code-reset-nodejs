# 88code 重置项目改造方案

**文档版本**: v1.0
**创建时间**: 2025-11-07
**基于版本**: 代码 v0.0.2 + reset-strategy-analysis.md v2.0
**分析结论**: 现有实现与新策略高度一致，仅需配置优化，**无需大规模重构**

---

## 目录

- [分析结论](#分析结论)
- [改动方案](#改动方案)
- [实施步骤](#实施步骤)
- [测试验证](#测试验证)
- [风险评估](#风险评估)

---

## 分析结论

### ✅ 现有实现评估

**核心策略一致性**: 🟢 **高度一致**

| 策略要点 | 现有实现 | 新策略文档 | 状态 |
|---------|---------|-----------|------|
| 固定检查点 | 18:55, 23:55 (可配置) | 18:55, 23:58 (可配置) | ✅ 一致 |
| 首次重置条件 | `resetTimes===2 && cooldown>=5h` | `resetTimes===2 && cooldown>=5h` | ✅ 完全一致 |
| 二次重置条件 | `resetTimes>=1 && cooldown>=5h` | `resetTimes>=1 && cooldown>=5h` | ✅ 完全一致 |
| 延迟重置机制 | ✅ 已实现 (23:59:49限制) | ✅ 提出 | ✅ 一致 |
| 冷却期 | 5小时 (可配置) | 5小时 (可配置) | ✅ 一致 |

**额外优势特性** (新策略文档未提及):
- ✅ **PAYGO保护机制**
- ✅ **多账号支持**（串行处理多个API Key）
- ✅ **多套餐支持**（每个订阅独立处理，详见下文）
- ✅ **速率限制**（令牌桶算法）
- ✅ **重试机制**（指数退避）
- ✅ **执行锁**（防并发）
- ✅ **详细日志**（Winston）

### ⚠️ 发现的问题

**配置层面**:
1. ❌ 缺少检查点间隔验证（存在配置错误风险）
2. ⚠️ 存在3处硬编码值（调试困难）
3. ⚠️ 2个未使用的配置项（ENABLE_HEALTH_CHECK, HEALTH_CHECK_PORT）

**代码层面**:
- 🟢 架构清晰，职责明确
- 🟢 核心逻辑正确
- 🟡 定时器管理可优化（但当前实现已足够）

### 🎯 改造策略

**原则**: **最小改动，最大收益**

- ✅ **Phase 1**: 配置完善与硬编码消除 (必须)
- ✅ **Phase 2**: 配置验证机制 (必须)
- 🟡 **Phase 3**: 定时器管理优化 (可选)
- 🔵 **Phase 4**: 代码清理 (可选)
- ❌ **不建议**: SimpleResetStrategy大规模重构 (风险高，收益低)

---

## 多套餐支持说明

### ✅ 现有实现已完美支持多套餐场景

**核心机制**：每个订阅完全独立处理

一个用户可能同时拥有多个 MONTHLY 类型的套餐（例如 Free月卡 + PLUS 198月卡 + Pro年卡），现有代码通过以下机制正确处理：

#### 独立性保证

每个订阅拥有独立的状态字段：

| 字段 | 说明 | 独立性保证 |
|-----|------|-----------|
| `subscription.id` | 订阅ID | ✅ 唯一标识每个套餐 |
| `subscription.lastCreditReset` | 上次重置时间 | ✅ 每个套餐独立的冷却期 |
| `subscription.resetTimes` | 剩余重置次数 | ✅ 每个套餐独立计数（0-2） |
| `subscription.currentCredits` | 当前剩余额度 | ✅ 每个套餐独立额度 |
| `subscription.subscriptionPlanName` | 套餐名称 | ✅ 区分Free/PLUS/Pro等 |

#### 处理流程

**代码位置**: `ResetService.js:41-96`

```javascript
// 1. 获取所有订阅（可能包含Free卡、PLUS卡、Pro卡等）
const subscriptions = await this.apiClient.getSubscriptions();

// 2. 逐个过滤符合条件的订阅
const eligibleSubscriptions = subscriptions.filter(sub =>
    this.isEligible(sub, resetType)  // 每个订阅独立判断
);

// 3. 逐个串行处理所有符合条件的订阅
for (const subscription of eligibleSubscriptions) {
    await this.processSubscription(subscription, resetType);
    // 每次重置后等待 REQUEST_INTERVAL_MS（默认1秒）
}
```

#### 多套餐场景示例

**假设用户同时拥有**:
- Free月卡 (MONTHLY, 每天50刀额度)
- PLUS 198月卡 (MONTHLY, 每天50刀额度)

**18:55 第一次检查**:
```
Free卡:  resetTimes=2, cooldown已过 → ✅ 重置Free卡 (+50刀)
PLUS卡: resetTimes=1, cooldown已过 → ⏭️  跳过PLUS卡 (保留给23:55)
```

**23:55 第二次检查**:
```
Free卡:  resetTimes=1, cooldown已过 → ✅ 重置Free卡 (+50刀)
PLUS卡: resetTimes=1, cooldown已过 → ✅ 重置PLUS卡 (+50刀)
```

**当天总额度**:
- Free卡: 100刀 (2次重置)
- PLUS卡: 95刀 (保留策略，1次重置 + 原有45刀)
- **总计**: 195刀 ✅

#### 延迟重置的多套餐支持

**场景：23:55时部分套餐冷却未满**

```
Free卡:  冷却未满 → ⏰ 创建延迟定时器，次日00:01触发
PLUS卡: 冷却已过 → ✅ 立即重置
```

**实现细节**:
- 定时器使用 `subscription.id` 作为唯一key
- 支持多个订阅同时有延迟定时器
- 每个定时器独立触发，互不干扰

**代码位置**: `ResetService.js:203`
```javascript
this.delayedTimers.set(subId, timerId);  // 使用订阅ID作为key
```

#### 理论最大值

如果用户拥有 N 个 MONTHLY 套餐，理论上：

| 场景 | 单个套餐最大值 | N个套餐总最大值 |
|-----|--------------|----------------|
| 完美规划（场景6） | 150刀/天 (3次×50) | **N × 150刀/天** |
| 标准场景 | 100刀/天 (2次×50) | **N × 100刀/天** |

**示例**：
- 2个套餐（Free + PLUS）：理论最大 300刀/天
- 3个套餐（Free + PLUS + Pro）：理论最大 450刀/天

#### 策略逻辑对多套餐的适用性

新策略文档中的所有场景（场景1-6）都适用于多套餐，因为：

1. **18:55保留策略** 对每个订阅独立判断：
   - 某个套餐 `resetTimes=2` → 该套餐重置
   - 某个套餐 `resetTimes=1` → 该套餐跳过

2. **23:55兜底策略** 对每个订阅独立判断：
   - 所有 `resetTimes>=1` 的套餐都会被重置

3. **冷却期检查** 完全独立：
   - 某个套餐在10:00重置，不影响其他套餐的冷却期

4. **延迟重置** 独立触发：
   - 可以同时有多个套餐的延迟定时器

#### 无需额外改动

✅ **现有代码已经完美支持多套餐**，Phase 1-4 的改动方案无需针对多套餐做任何调整。

#### 测试建议

建议在回归测试中增加多套餐场景：

| 测试场景 | 套餐配置 | 验证点 |
|---------|---------|--------|
| 多套餐并行重置 | Free卡(resetTimes=2) + PLUS卡(resetTimes=2) | 18:55两个都重置 |
| 多套餐保留策略 | Free卡(resetTimes=2) + PLUS卡(resetTimes=1) | 18:55仅重置Free卡 |
| 多套餐延迟重置 | Free卡(冷却未满) + PLUS卡(冷却已过) | Free卡设置定时器，PLUS卡立即重置 |
| 多套餐冷却独立性 | Free卡(10:00重置) + PLUS卡(14:00重置) | 18:55各自独立判断冷却期 |

---

## 改动方案

### 🔥 Phase 1: 配置完善与硬编码消除 ⚠️ **必须实施**

**目标**: 消除硬编码值，提高配置灵活性和可调试性

#### 1.1 修改 `.env` - 新增配置项

在 `.env` 文件 `# ==================== 高级配置 ====================` 之前新增：

```bash
# ==================== 性能调优 ====================

# 重置请求间隔（毫秒）
# 多个订阅串行重置时的等待时间
REQUEST_INTERVAL_MS=1000

# 重置后验证等待时间（毫秒）
# 等待88code API更新订阅信息的时间
RESET_VERIFICATION_WAIT_MS=3000

# 速率限制等待超时（毫秒）
# 等待令牌桶分配令牌的最大超时时间
RATE_LIMIT_WAIT_TIMEOUT=60000
```

#### 1.2 修改 `src/config.js` - 加载新配置

在 `config` 对象中添加（第104行附近，`enableHealthCheck` 之前）：

```javascript
// 性能调优
requestIntervalMs: parseInt(process.env.REQUEST_INTERVAL_MS) || 1000,
resetVerificationWaitMs: parseInt(process.env.RESET_VERIFICATION_WAIT_MS) || 3000,
rateLimitWaitTimeout: parseInt(process.env.RATE_LIMIT_WAIT_TIMEOUT) || 60000,
```

完整的新增部分：

```javascript
export const config = {
    // ... 现有配置保持不变

    // 高级配置
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === 'true',
    healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT) || 3000,
    runTestOnStart: process.env.RUN_TEST_ON_START !== 'false',

    // 性能调优
    requestIntervalMs: parseInt(process.env.REQUEST_INTERVAL_MS) || 1000,
    resetVerificationWaitMs: parseInt(process.env.RESET_VERIFICATION_WAIT_MS) || 3000,
    rateLimitWaitTimeout: parseInt(process.env.RATE_LIMIT_WAIT_TIMEOUT) || 60000,

    // 环境
    nodeEnv: process.env.NODE_ENV || 'production',
    rootDir,
};
```

#### 1.3 修改 `src/core/ResetService.js` - 替换硬编码

**位置1**: 第94行 - 重置请求间隔

```javascript
// 修改前：
await new Promise(resolve => setTimeout(resolve, 1000));

// 修改后：
await new Promise(resolve => setTimeout(resolve, config.requestIntervalMs));
```

**位置2**: 第283行 - 重置验证等待

```javascript
// 修改前：
await new Promise(resolve => setTimeout(resolve, 3000));

// 修改后：
await new Promise(resolve => setTimeout(resolve, config.resetVerificationWaitMs));
```

#### 1.4 修改 `src/core/APIClient.js` - 替换硬编码

**位置**: 第46行 - 速率限制等待超时

```javascript
// 修改前：
const hasToken = await APIClient.rateLimiter.waitForToken(60000);

// 修改后：
const hasToken = await APIClient.rateLimiter.waitForToken(config.rateLimitWaitTimeout);
```

**预计工作量**: 30分钟
**风险评估**: 🟢 **低** - 仅配置化现有硬编码值，不改变逻辑
**测试要求**: 验证配置正确加载，功能行为与之前一致

---

### 🔥 Phase 2: 配置验证机制 ⚠️ **必须实施**

**目标**: 启动时自动检测配置错误，避免运行时问题

#### 2.1 创建 `src/utils/ConfigValidator.js`

```javascript
/**
 * 配置验证工具
 * 在应用启动时验证配置的合法性
 */

import Logger from './Logger.js';

export class ConfigValidator {
    /**
     * 验证检查点时间配置
     * 确保两个检查点间隔>=5小时2分钟，避免冷却期冲突
     *
     * @param {string} firstTime - 第一次检查时间 (HH:MM)
     * @param {string} secondTime - 第二次检查时间 (HH:MM)
     * @throws {Error} 如果间隔不足5小时2分钟
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

        // 最小间隔：5小时2分钟 = 302分钟
        // 留2分钟缓冲，避免边界问题
        const MIN_INTERVAL = 5 * 60 + 2;

        if (diffMinutes < MIN_INTERVAL) {
            const error =
                `❌ 检查点时间间隔不足！\n` +
                `  第一次检查: ${firstTime}\n` +
                `  第二次检查: ${secondTime}\n` +
                `  实际间隔: ${diffMinutes}分钟 (${this.formatMinutes(diffMinutes)})\n` +
                `  要求间隔: 至少 ${MIN_INTERVAL}分钟 (5小时2分钟)\n\n` +
                `推荐配置组合:\n` +
                `  - 18:55 和 23:58 (间隔 5小时3分钟) ✅ 推荐\n` +
                `  - 18:50 和 23:58 (间隔 5小时8分钟) ✅ 更安全\n` +
                `  - 18:55 和 23:57 (间隔 5小时2分钟) ⚠️  最低限度`;

            throw new Error(error);
        }

        Logger.info(
            `✅ 检查点时间验证通过: ${firstTime} -> ${secondTime} ` +
            `(间隔 ${diffMinutes}分钟 / ${this.formatMinutes(diffMinutes)})`
        );
    }

    /**
     * 解析时间字符串为小时和分钟
     * @param {string} timeStr - 时间字符串 (HH:MM)
     * @returns {{ hour: number, minute: number }}
     * @throws {Error} 如果时间格式无效
     */
    static parseTime(timeStr) {
        const parts = timeStr.split(':');

        if (parts.length !== 2) {
            throw new Error(`无效时间格式: ${timeStr}，期望格式: HH:MM`);
        }

        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);

        if (isNaN(hour) || isNaN(minute)) {
            throw new Error(`无效时间格式: ${timeStr}，小时和分钟必须是数字`);
        }

        if (hour < 0 || hour > 23) {
            throw new Error(`小时超出范围: ${hour}，必须在 0-23 之间`);
        }

        if (minute < 0 || minute > 59) {
            throw new Error(`分钟超出范围: ${minute}，必须在 0-59 之间`);
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
```

#### 2.2 修改 `src/config.js` - 添加验证调用

在文件末尾，`validateConfig(config)` 调用之后添加：

```javascript
// 验证配置（原有代码）
validateConfig(config);

// 新增：验证检查点时间配置
import ConfigValidator from './utils/ConfigValidator.js';
ConfigValidator.validateCheckpointTimes(config.firstResetTime, config.secondResetTime);

// 导出配置
export default config;
```

完整的文件末尾部分：

```javascript
// 验证配置
validateConfig(config);

// 验证检查点时间配置
import ConfigValidator from './utils/ConfigValidator.js';
ConfigValidator.validateCheckpointTimes(config.firstResetTime, config.secondResetTime);

// 导出配置
export default config;
```

**预计工作量**: 30分钟
**风险评估**: 🟢 **低** - 仅增加验证逻辑，不影响现有功能
**测试要求**:
- ✅ 合法配置（18:55, 23:58）能正常启动
- ❌ 非法配置（18:55, 23:00）能正确报错并退出

---

### 🟡 Phase 3: 定时器管理优化 (可选)

**目标**: 统一定时器管理，提高代码可维护性

#### 3.1 创建 `src/core/DynamicTimerManager.js`

```javascript
/**
 * 动态定时器管理器
 * 统一管理延迟重置定时器，支持批量清理
 */

import Logger from '../utils/Logger.js';

export class DynamicTimerManager {
    constructor() {
        // 存储定时器映射: name -> timerId
        this.timers = new Map();
    }

    /**
     * 设置定时器
     * 自动清除同名的旧定时器（避免重复）
     *
     * @param {string} name - 定时器名称（唯一标识）
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
```

#### 3.2 修改 `src/core/ResetService.js` - 使用新管理器

**修改1**: 引入DynamicTimerManager（文件顶部）

```javascript
import DynamicTimerManager from './DynamicTimerManager.js';
```

**修改2**: 构造函数（第14-18行）

```javascript
// 修改前：
export class ResetService {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.delayedTimers = new Map(); // 存储延迟定时器
    }

// 修改后：
export class ResetService {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.timerManager = new DynamicTimerManager(); // 使用定时器管理器
    }
```

**修改3**: processSubscriptionWithDelay方法（第220-243行）

```javascript
// 修改前（第239-242行）：
const timerId = setTimeout(async () => {
    // ... 定时器逻辑
}, delayMs);

// 保存定时器引用
this.delayedTimers.set(subId, timerId);

// 修改后：
const timerId = setTimeout(async () => {
    Logger.info(`[订阅${subId}] 开始执行延迟重置`);

    try {
        const result = await this.processSubscription(subscription, resetType);
        this.timerManager.clear(`delayed-reset-${subId}`); // 清除已完成的定时器
        resolve(result);
    } catch (error) {
        Logger.error(`[订阅${subId}] 延迟重置失败`, error);
        this.timerManager.clear(`delayed-reset-${subId}`); // 清除失败的定时器
        resolve({
            subscriptionId: subId,
            subscriptionName: subscription.subscriptionPlanName,
            status: RESET_STATUS.FAILED,
            message: '延迟重置失败',
            error: error.message,
        });
    }
}, delayMs);

// 使用新管理器保存定时器
this.timerManager.set(`delayed-reset-${subId}`, timerId);
```

**修改4**: clearDelayedTimers方法（第334-340行）

```javascript
// 修改前：
clearDelayedTimers() {
    for (const [subId, timerId] of this.delayedTimers.entries()) {
        clearTimeout(timerId);
        Logger.debug(`已清理订阅${subId}的延迟定时器`);
    }
    this.delayedTimers.clear();
}

// 修改后：
clearDelayedTimers() {
    Logger.info('清理所有延迟定时器...');
    this.timerManager.clearAll();
}
```

**预计工作量**: 1小时
**风险评估**: 🟡 **中** - 重构定时器管理，需要测试延迟重置功能
**测试要求**:
- 重点测试**场景3**（冷却期未满延迟重置）
- 验证定时器正确触发和清理
- 测试程序关闭时定时器能正确清理

---

### 🔵 Phase 4: 代码清理 (可选)

**目标**: 清理未使用的配置项

#### 4.1 修改 `.env` - 标记或删除未使用配置

```bash
# ==================== 高级配置 ====================

# 健康检查HTTP服务器（未实现，可选）
# 如需实现，设置为true并配置端口
# ENABLE_HEALTH_CHECK=false
# HEALTH_CHECK_PORT=3000

# 是否在启动时执行一次测试
RUN_TEST_ON_START=true

# ==================== GitHub Actions 配置 ====================
# （注意：此配置项未在代码中使用，可以删除）
# STATE_DIR=./.github
```

#### 4.2 修改 `src/config.js` - 添加注释说明（可选）

```javascript
// 高级配置
enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === 'true', // 未实现，保留用于未来扩展
healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT) || 3000,
runTestOnStart: process.env.RUN_TEST_ON_START !== 'false',
```

**预计工作量**: 10分钟
**风险评估**: 🟢 **低** - 仅清理注释，不影响功能
**建议**: 如果计划未来实现健康检查，可以保留这些配置

---

## 实施步骤

### 建议实施顺序

```
Phase 1 (必须) → Phase 2 (必须) → 测试验证 → Phase 3 (可选) → Phase 4 (可选)
```

### 详细步骤

#### Step 1: Phase 1 - 配置完善 (30分钟)

1. ✅ 修改 `.env` - 新增3个配置项
2. ✅ 修改 `src/config.js` - 加载新配置
3. ✅ 修改 `src/core/ResetService.js` - 替换2处硬编码
4. ✅ 修改 `src/core/APIClient.js` - 替换1处硬编码

**验证点**:
```bash
# 启动程序，查看日志确认配置加载成功
npm start

# 检查日志中是否显示新配置值
```

#### Step 2: Phase 2 - 配置验证 (30分钟)

1. ✅ 创建 `src/utils/ConfigValidator.js`
2. ✅ 修改 `src/config.js` - 添加验证调用

**验证点**:
```bash
# 测试1: 合法配置 (18:55, 23:58)
npm start  # 应该正常启动

# 测试2: 非法配置 (18:55, 23:00)
# 临时修改 .env: SECOND_RESET_TIME=23:00
npm start  # 应该报错并退出

# 恢复配置
# 修改 .env: SECOND_RESET_TIME=23:58
```

#### Step 3: 测试验证 (30分钟)

运行完整测试流程（见下一节）

#### Step 4: Phase 3 - 定时器管理优化 (1小时，可选)

1. ✅ 创建 `src/core/DynamicTimerManager.js`
2. ✅ 修改 `src/core/ResetService.js` - 重构定时器管理

**验证点**:
- 运行场景3测试（冷却期未满延迟重置）
- 验证定时器正确触发和清理

#### Step 5: Phase 4 - 代码清理 (10分钟，可选)

1. ✅ 修改 `.env` - 添加注释
2. ✅ 修改 `src/config.js` - 添加注释（可选）

---

## 测试验证

### 单元测试清单

#### Phase 1 测试

| 测试项 | 验证内容 | 期望结果 |
|-------|---------|---------|
| 配置加载 | 验证新配置项正确加载 | 日志显示新配置值 |
| 请求间隔 | 多订阅重置时使用配置的间隔 | 使用 `REQUEST_INTERVAL_MS` |
| 验证等待 | 重置后使用配置的等待时间 | 使用 `RESET_VERIFICATION_WAIT_MS` |
| 速率限制 | 令牌等待使用配置的超时 | 使用 `RATE_LIMIT_WAIT_TIMEOUT` |

#### Phase 2 测试

| 测试项 | 配置 | 期望结果 |
|-------|------|---------|
| 合法配置 | `18:55, 23:58` | ✅ 验证通过，正常启动 |
| 合法配置 | `18:50, 23:58` | ✅ 验证通过，正常启动 |
| 边界配置 | `18:55, 23:57` | ✅ 验证通过（最低限度） |
| 非法配置 | `18:55, 23:55` | ❌ 报错并退出 |
| 非法配置 | `18:55, 23:00` | ❌ 报错并退出 |
| 非法配置 | `19:00, 23:58` | ❌ 报错并退出 |
| 无效格式 | `18:55, 25:00` | ❌ 报错并退出 |

#### Phase 3 测试

| 测试项 | 场景 | 验证内容 |
|-------|------|---------|
| 延迟重置 | 场景3 | 冷却期未满时正确设置定时器 |
| 定时器触发 | 场景3 | 定时器到期后正确执行重置 |
| 定时器清理 | 正常关闭 | SIGTERM/SIGINT时清理所有定时器 |
| 定时器去重 | 重复设置 | 同名定时器自动清除旧的 |

### 场景测试（基于新策略文档）

建议使用 **时间模拟** 或 **干跑模式** 测试以下场景：

| 场景 | 说明 | 验证点 | 期望结果 |
|-----|------|--------|----------|
| 场景1 | 完美状态 (resetTimes=2) | 18:55重置 + 23:55重置 | 100-130刀 |
| 场景2 | 关键场景 (resetTimes=1) | 18:55跳过 + 23:55重置 | 95刀 |
| 场景3 | 冷却期未满 | 23:55设置定时器 + 次日00:01触发 | 定时器正确触发 |
| 场景4 | 快速消耗 | 自动重置 + 23:55重置 | 100刀 |
| 场景5 | 重置次数耗尽 | 18:55跳过 + 23:55跳过 | 正确拒绝 |
| 场景6 | 跨天累积 | 保留额度 + 自动重置 + 23:55重置 | 150刀 |

### 回归测试

在所有改动完成后，运行以下回归测试：

```bash
# 1. API连接测试
npm run test

# 2. 启动服务
npm start

# 3. 检查日志
# - 配置加载成功
# - 检查点时间验证通过
# - 定时任务调度成功

# 4. 手动触发重置（可选）
npm run reset:first  -- --dry-run
npm run reset:second -- --dry-run

# 5. 查看统计（可选）
npm run reset:stats
```

---

## 风险评估

### 总体风险评估

| 阶段 | 风险等级 | 主要风险 | 缓解措施 |
|-----|---------|---------|----------|
| Phase 1 | 🟢 低 | 配置加载错误 | 保留默认值，向后兼容 |
| Phase 2 | 🟢 低 | 验证逻辑过严 | 充分测试边界情况 |
| Phase 3 | 🟡 中 | 定时器逻辑错误 | 重点测试场景3 |
| Phase 4 | 🟢 低 | 误删重要配置 | 仅添加注释，不删除 |

### 具体风险点

#### 1. 配置加载风险

**风险**: 新配置项未正确加载，导致使用默认值

**缓解措施**:
- ✅ 设置合理的默认值（与硬编码值一致）
- ✅ 启动时打印配置摘要日志
- ✅ 向后兼容（配置缺失时不影响功能）

#### 2. 检查点验证风险

**风险**: 验证逻辑过严，阻止合法配置

**缓解措施**:
- ✅ 最小间隔设置为5小时2分钟（留2分钟缓冲）
- ✅ 详细的错误提示和推荐配置
- ✅ 充分测试边界情况

#### 3. 定时器重构风险

**风险**: 延迟重置定时器未正确触发或清理

**缓解措施**:
- ✅ 保持原有逻辑不变，仅封装管理
- ✅ 增加定时器状态日志
- ✅ 测试场景3（冷却期未满）
- ✅ 测试程序关闭时的清理逻辑

#### 4. 回归风险

**风险**: 改动影响现有功能

**缓解措施**:
- ✅ 最小化改动范围
- ✅ 充分的回归测试
- ✅ 保留原有日志和监控
- ✅ 逐阶段实施，每阶段验证

---

## 附录

### A. 环境变量完整清单

#### 已使用的变量

| 变量名 | 默认值 | 说明 | 使用位置 |
|-------|-------|------|---------|
| **API配置** ||||
| `API_KEYS` | (必填) | API密钥，多个用逗号分隔 | `APIClient.js` |
| `API_BASE_URL` | `https://www.88code.org` | API基础URL | `APIClient.js` |
| `API_TIMEOUT` | `30000` | 请求超时时间（毫秒） | `APIClient.js` |
| **重置策略** ||||
| `FIRST_RESET_TIME` | `18:55` | 首次重置时间 | `Scheduler.js` |
| `SECOND_RESET_TIME` | `23:56` | 二次重置时间 | `Scheduler.js` |
| `TIMEZONE` | `Asia/Shanghai` | 时区 | `Scheduler.js`, `TimeUtils.js` |
| `COOLDOWN_HOURS` | `5` | 冷却期（小时） | `constants.js` |
| `END_OF_DAY_BUFFER` | `10` | 延迟重置缓冲（秒） | `constants.js` |
| **重试配置** ||||
| `ENABLE_RETRY` | `true` | 是否启用重试 | `APIClient.js` |
| `MAX_RETRIES` | `3` | 最大重试次数 | `RetryHelper.js` |
| `RETRY_BASE_DELAY` | `1000` | 重试延迟基数（毫秒） | `RetryHelper.js` |
| **速率限制** ||||
| `ENABLE_RATE_LIMIT` | `true` | 是否启用速率限制 | `APIClient.js` |
| `RATE_LIMIT_CAPACITY` | `10` | 令牌桶容量 | `RateLimiter.js` |
| `RATE_LIMIT_REFILL_RATE` | `10` | 令牌补充速率（个/分钟） | `RateLimiter.js` |
| **日志配置** ||||
| `LOG_LEVEL` | `info` | 日志级别 | `Logger.js` |
| `LOG_FILE_ENABLED` | `true` | 是否启用文件日志 | `Logger.js` |
| `LOG_DIR` | `./logs` | 日志目录 | `Logger.js` |
| `LOG_MAX_SIZE` | `10` | 日志文件最大大小（MB） | `Logger.js` |
| `LOG_MAX_DAYS` | `30` | 日志文件保留天数 | `Logger.js` |
| **存储配置** ||||
| `DATA_DIR` | `./data` | 数据目录 | `StateManager.js` |
| `ENABLE_HISTORY` | `true` | 是否启用历史记录 | `StateManager.js` |
| `HISTORY_MAX_DAYS` | `90` | 历史记录保留天数 | `StateManager.js` |
| **高级配置** ||||
| `RUN_TEST_ON_START` | `true` | 启动时执行测试 | `index.js` |
| **性能调优 (Phase 1新增)** ||||
| `REQUEST_INTERVAL_MS` | `1000` | 重置请求间隔（毫秒） | `ResetService.js` |
| `RESET_VERIFICATION_WAIT_MS` | `3000` | 重置验证等待（毫秒） | `ResetService.js` |
| `RATE_LIMIT_WAIT_TIMEOUT` | `60000` | 速率限制等待超时（毫秒） | `APIClient.js` |

#### 未使用的变量

| 变量名 | 建议 |
|-------|------|
| `ENABLE_HEALTH_CHECK` | 保留（未来可能实现） |
| `HEALTH_CHECK_PORT` | 保留（未来可能实现） |
| `STATE_DIR` | 删除（完全未使用） |

### B. 硬编码值清单

| 文件 | 行号 | 硬编码值 | 替换为 | Phase |
|-----|------|---------|--------|-------|
| `ResetService.js` | 94 | `1000`ms | `config.requestIntervalMs` | Phase 1 |
| `ResetService.js` | 283 | `3000`ms | `config.resetVerificationWaitMs` | Phase 1 |
| `APIClient.js` | 46 | `60000`ms | `config.rateLimitWaitTimeout` | Phase 1 |

### C. 改动文件清单

| 阶段 | 文件路径 | 操作 | 说明 |
|-----|---------|------|------|
| **Phase 1** ||||
| | `.env` | 修改 | 新增3个配置项 |
| | `src/config.js` | 修改 | 加载新配置 |
| | `src/core/ResetService.js` | 修改 | 替换2处硬编码 |
| | `src/core/APIClient.js` | 修改 | 替换1处硬编码 |
| **Phase 2** ||||
| | `src/utils/ConfigValidator.js` | 创建 | 配置验证工具 |
| | `src/config.js` | 修改 | 添加验证调用 |
| **Phase 3** ||||
| | `src/core/DynamicTimerManager.js` | 创建 | 定时器管理器 |
| | `src/core/ResetService.js` | 修改 | 使用新管理器 |
| **Phase 4** ||||
| | `.env` | 修改 | 添加注释 |
| | `src/config.js` | 修改 | 添加注释（可选） |

---

## 最终建议

### 立即实施（必须）

**Phase 1 + Phase 2** - 预计总工作量：1小时

**理由**:
1. ✅ **消除技术债务**: 移除3处硬编码，提高可维护性
2. ✅ **防止配置错误**: 自动检测间隔不足，避免生产事故
3. ✅ **风险极低**: 仅配置化现有逻辑，不改变行为
4. ✅ **收益明显**: 提高调试效率和配置灵活性

### 可选实施

**Phase 3** - 预计工作量：1小时

**评估标准**:
- 如果当前延迟重置功能稳定，可暂缓
- 如果需要增强定时器管理能力，建议实施
- 如果计划长期维护，建议实施

**Phase 4** - 预计工作量：10分钟

**建议**: 随时可以实施，影响极小

### 不建议实施

**SimpleResetStrategy大规模重构**

**理由**:
- ❌ 当前架构已经很清晰
- ❌ 重构风险高，收益低
- ❌ 现有实现与新策略高度一致

---

**文档结束**

**下一步**: 按照 Phase 1 → Phase 2 顺序开始实施
