# 88code Reset Service - 测试文档

本文档详细说明测试套件的架构、使用方法和设计理念。

---

## 📋 目录

- [测试架构](#测试架构)
- [快速开始](#快速开始)
- [测试覆盖](#测试覆盖)
- [Mock 工具](#mock-工具)
- [测试夹具](#测试夹具)
- [常见场景](#常见场景)
- [故障排查](#故障排查)

---

## 🏗️ 测试架构

### 目录结构

```
tests/
├── fixtures/              # 测试数据夹具
│   └── subscriptions.js   # 模拟各种订阅状态
├── mocks/                 # Mock 工具
│   ├── APIClientMock.js   # API 调用模拟
│   ├── TimeMock.js        # 时间加速模拟
│   ├── StorageMock.js     # 存储和通知模拟
│   └── index.js           # 统一导出
├── unit/                  # 单元测试
│   ├── ResetService.test.js        # 核心重置逻辑
│   ├── TimeUtils.test.js           # Cooldown 计算
│   └── DynamicTimerManager.test.js # 定时器管理
├── integration/           # 集成测试
│   └── reset-flow.test.js # 完整重置流程
├── helpers/               # 测试辅助工具（预留）
├── run-all.js            # 测试运行器
└── README.md             # 本文档
```

### 设计原则

基于 **Linus Torvalds "Good Taste"** 原则：

1. **消除特殊情况**: 统一的测试夹具和 Mock 接口
2. **数据结构优先**: 从 Subscription 状态驱动测试逻辑
3. **简洁执行**: 使用 Node.js 内置测试框架，零额外依赖
4. **实用主义**: 解决真实问题（cooldown、延迟重置），不过度设计

---

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 运行测试

```bash
# 运行所有测试
npm test

# 只运行单元测试
npm run test:unit

# 只运行集成测试
npm run test:integration

# 监听模式（文件变化自动重新运行）
npm run test:watch
```

### 测试配置

测试使用独立的配置文件：`.env.test`

```bash
API_KEYS=test-api-key-1234567890  # Fake API key
COOLDOWN_HOURS=5                   # 真实值，mock 中会加速
LOG_LEVEL=error                    # 减少测试输出
ENABLE_RATE_LIMIT=false           # 加速测试
REQUEST_INTERVAL_MS=100           # 快速执行
RESET_VERIFICATION_WAIT_MS=100    # 快速验证
```

---

## 🎯 测试覆盖

### 1. ResetService 核心逻辑

**测试文件**: `tests/unit/ResetService.test.js`

#### P0: PAYGO 保护（最高优先级）
- ✅ 应该跳过 PAYGO 订阅
- ✅ 应该识别各种 PAYGO 变体（PAYGO, PAY_PER_USE）

#### P1: 类型和状态过滤
- ✅ 只处理 MONTHLY 类型订阅
- ✅ 跳过 inactive 订阅
- ✅ 跳过 YEARLY 类型

#### P2: Cooldown 逻辑
- ✅ FIRST checkpoint: 跳过 cooldown 未过的订阅
- ✅ SECOND checkpoint: 调度延迟重置当 cooldown 未过
- ✅ SECOND checkpoint: 立即重置当 cooldown 已过

#### P3: resetTimes 策略
- ✅ FIRST checkpoint: 只重置 `resetTimes == 2` 的订阅
- ✅ SECOND checkpoint: 重置 `resetTimes >= 1` 的订阅
- ✅ 边界情况验证（0, 1, 2, 3）

#### 重置执行
- ✅ 成功重置符合条件的订阅
- ✅ 处理 API 失败情况
- ✅ 串行处理多个订阅

#### 结果统计
- ✅ 正确统计各种状态（success, failed, skipped, scheduled）
- ✅ 记录执行时间和持续时间

#### 边界情况
- ✅ 空订阅列表
- ✅ 所有订阅都不符合条件
- ✅ getSubscriptions API 失败

---

### 2. TimeUtils 时间计算

**测试文件**: `tests/unit/TimeUtils.test.js`

#### Cooldown 检查
- ✅ 检测 cooldown 已过（6小时前）
- ✅ 检测 cooldown 未过（3小时前）
- ✅ 边界情况：刚好 5 小时
- ✅ 边界情况：差一秒到 5 小时
- ✅ 处理 null/空 lastResetTime
- ✅ 处理无效时间字符串
- ✅ 计算 cooldown 结束时间

#### 时间格式化
- ✅ 格式化时长：小时（2h 30m）
- ✅ 格式化时长：分钟（5m 45s）
- ✅ 格式化时长：秒（30s）
- ✅ 格式化日期时间
- ✅ 处理无效日期

#### Cron 表达式
- ✅ 解析时间字符串（18:55, 23:58）
- ✅ 生成正确的 Cron 表达式
- ✅ 拒绝无效的时间格式
- ✅ 拒绝超出范围的值（25:00, 12:60）

#### 下次执行时间计算
- ✅ 计算距离下次执行的时间
- ✅ 处理已过的时间（返回明天）

---

### 3. DynamicTimerManager 定时器管理

**测试文件**: `tests/unit/DynamicTimerManager.test.js`

#### 基础操作
- ✅ 设置定时器
- ✅ 清除指定定时器
- ✅ 允许清除不存在的定时器
- ✅ 返回正确的定时器数量

#### 同名定时器覆盖
- ✅ 自动清除旧的同名定时器
- ✅ 防止定时器泄漏

#### 批量清除
- ✅ 清除所有定时器
- ✅ 允许多次调用 clearAll

#### 定时器执行验证
- ✅ 允许定时器正常执行
- ✅ 清除定时器应该阻止其执行
- ✅ 正确处理多个定时器的执行

#### 边界情况
- ✅ 立即执行的定时器（delay=0）
- ✅ 多次设置和清除同一个名称
- ✅ 不同命名空间的定时器

---

### 4. 集成测试 - 完整流程

**测试文件**: `tests/integration/reset-flow.test.js`

#### FIRST Checkpoint 流程
- ✅ 完整的 FIRST checkpoint 重置流程
- ✅ 正确过滤 cooldown 未过的订阅

#### SECOND Checkpoint 流程
- ✅ 完整的 SECOND checkpoint 重置流程
- ✅ 调度延迟重置当 cooldown 未过
- ✅ 混合场景：立即重置 + 延迟重置 + 跳过

#### 错误处理
- ✅ 处理 API 失败并继续处理其他订阅
- ✅ 处理 getSubscriptions 失败

#### 状态验证
- ✅ 验证重置后的订阅状态
- ✅ 记录执行时间和持续时间

#### 通知系统
- ✅ 发送通知给 NotifierManager
- ✅ 处理通知发送失败

---

## 🔧 Mock 工具

### APIClientMock

**文件**: `tests/mocks/APIClientMock.js`

模拟 API 调用，支持：
- ✅ 设置 mock 订阅数据
- ✅ 模拟成功/失败场景
- ✅ 记录调用历史
- ✅ 模拟 API 延迟

**使用示例**:

```javascript
import { APIClientMock, APIErrors } from '../mocks/APIClientMock.js';

const apiClient = new APIClientMock();

// 设置 mock 数据
apiClient.setSubscriptions([subscription1, subscription2]);

// 执行操作
await service.executeReset(RESET_TYPES.FIRST);

// 验证调用次数
assert.strictEqual(apiClient.resetCallCount, 2);

// 模拟失败
apiClient.mockResetFailure(APIErrors.SERVER_ERROR);

// 查看调用历史
const stats = apiClient.getStats();
console.log(stats.resetHistory);
```

**常见错误场景**:

```javascript
APIErrors.UNAUTHORIZED      // 401
APIErrors.FORBIDDEN         // 403
APIErrors.RATE_LIMIT        // 429
APIErrors.SERVER_ERROR      // 500
APIErrors.TIMEOUT           // 超时
```

---

### TimeMock

**文件**: `tests/mocks/TimeMock.js`

加速时间模拟，将 5 小时 cooldown 压缩到秒级：

**核心特性**:
- ✅ 时间加速（默认 3600x）
- ✅ 推进时间
- ✅ 快速等待
- ✅ Mock 定时器

**使用示例**:

```javascript
import { createFastTime, wait } from '../mocks/TimeMock.js';

const time = createFastTime(3600); // 3600倍加速

// 创建过去的时间
const threeHoursAgo = time.hoursAgo(3);  // 实际只过了 3 秒

// 获取加速后的 cooldown 时间
const cooldownMs = time.getCooldownMs();  // 5小时 -> 5秒

// 快速等待
await wait(100);  // 等待 100ms
```

**加速原理**:

```
真实时间    加速时间 (3600x)
5 小时  →  5 秒
1 小时  →  1 秒
10 分钟 →  600ms
1 分钟  →  100ms
```

---

### StorageMock

**文件**: `tests/mocks/StorageMock.js`

模拟文件存储和通知发送：

#### FileStorageMock

```javascript
import { FileStorageMock } from '../mocks/StorageMock.js';

const storage = new FileStorageMock();

// 保存记录
await storage.saveResetHistory(result);

// 获取历史
const history = await storage.getResetHistory(7);

// 获取统计
const stats = storage.getStats();
```

#### NotifierManagerMock

```javascript
import { NotifierManagerMock } from '../mocks/StorageMock.js';

const notifier = new NotifierManagerMock();

// 发送通知
await notifier.notify(result);

// 模拟失败
notifier.mockFailure();

// 查看通知历史
const notifications = notifier.getAllNotifications();
```

---

## 📦 测试夹具

**文件**: `tests/fixtures/subscriptions.js`

提供各种订阅状态的测试数据：

### 基础夹具

```javascript
import {
  createIdealSubscription,      // 理想订阅（应该被重置）
  createPaygoSubscription,       // PAYGO 订阅（永不重置）
  createInactiveSubscription,    // 未激活订阅
  createCooldownPendingSubscription, // Cooldown 未过
  createFreshSubscription,       // resetTimes=0
  createOnceResetSubscription,   // resetTimes=1
  createMaxResetSubscription,    // resetTimes=3
} from '../fixtures/subscriptions.js';

// 创建自定义订阅
const subscription = createIdealSubscription({
  subscription_id: 'custom-001',
  resetTimes: 2,
  last_reset_at: hoursAgo(6),
});
```

### Checkpoint 专用夹具

```javascript
import {
  createFirstCheckpointEligible,    // FIRST 应该重置
  createFirstCheckpointIneligible,  // FIRST 应该跳过
  createSecondCheckpointEligible,   // SECOND 应该重置
  createSecondCheckpointIneligible, // SECOND 应该跳过
} from '../fixtures/subscriptions.js';
```

### 边界情况夹具

```javascript
import {
  createJustPassedCooldownSubscription,  // 刚好过了 cooldown
  createJustBeforeCooldownSubscription,  // 刚好没过 cooldown
} from '../fixtures/subscriptions.js';
```

---

## 🎬 常见场景

### 场景 1: 测试 PAYGO 保护

```javascript
it('应该跳过 PAYGO 订阅', async () => {
  const { service, apiClient } = createTestResetService();

  const subscriptions = [
    createPaygoSubscription(),
    createIdealSubscription(),
  ];

  apiClient.setSubscriptions(subscriptions.map(toAPIFormat));
  const result = await service.executeReset(RESET_TYPES.FIRST);

  // 验证：只有非 PAYGO 订阅被处理
  assert.strictEqual(result.eligible, 1);
  assert.strictEqual(apiClient.resetCallCount, 1);
});
```

### 场景 2: 测试 Cooldown 边界

```javascript
it('应该处理刚好过 cooldown 的订阅', () => {
  const lastReset = new Date(Date.now() - 5 * 60 * 60 * 1000 - 1000); // 5h + 1s
  const result = TimeUtils.checkCooldown(lastReset.toISOString());

  assert.strictEqual(result.passed, true);
});

it('应该处理刚好未过 cooldown 的订阅', () => {
  const lastReset = new Date(Date.now() - 5 * 60 * 60 * 1000 + 1000); // 5h - 1s
  const result = TimeUtils.checkCooldown(lastReset.toISOString());

  assert.strictEqual(result.passed, false);
  assert.ok(result.remaining < 2000); // 剩余约 1 秒
});
```

### 场景 3: 测试延迟重置

```javascript
it('应该调度延迟重置当 cooldown 未过', async () => {
  const { service, apiClient } = createTestResetService();

  const subscriptions = [
    createCooldownPendingSubscription({ resetTimes: 2 }),
  ];

  apiClient.setSubscriptions(subscriptions.map(toAPIFormat));
  const result = await service.executeReset(RESET_TYPES.SECOND);

  // 验证：返回 SCHEDULED 状态
  assert.strictEqual(result.scheduled, 1);
  assert.strictEqual(apiClient.resetCallCount, 0); // 未立即调用

  // 验证：延迟定时器已设置
  assert.strictEqual(service.timerManager.getCount(), 1);

  // 清理
  service.clearDelayedTimers();
});
```

### 场景 4: 测试 API 失败

```javascript
it('应该处理 API 失败', async () => {
  const { service, apiClient } = createTestResetService();

  const subscriptions = [createIdealSubscription()];
  apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

  // 模拟 API 失败
  apiClient.mockResetFailure(APIErrors.SERVER_ERROR);

  const result = await service.executeReset(RESET_TYPES.FIRST);

  // 验证：记录失败
  assert.strictEqual(result.failed, 1);
  const failedDetail = result.details.find(d => d.status === RESET_STATUS.FAILED);
  assert.ok(failedDetail.error);
});
```

### 场景 5: 测试混合场景

```javascript
it('应该处理混合场景', async () => {
  const { service, apiClient } = createTestResetService();

  const subscriptions = [
    createIdealSubscription({ resetTimes: 2 }),        // 立即重置
    createCooldownPendingSubscription({ resetTimes: 2 }), // 延迟重置
    createFreshSubscription(),                         // 跳过
    createPaygoSubscription(),                         // 跳过
  ];

  apiClient.setSubscriptions(subscriptions.map(toAPIFormat));
  const result = await service.executeReset(RESET_TYPES.SECOND);

  // 验证统计
  assert.strictEqual(result.totalSubscriptions, 4);
  assert.strictEqual(result.eligible, 2);
  assert.strictEqual(result.success, 1);   // 立即重置
  assert.strictEqual(result.scheduled, 1); // 延迟重置

  service.clearDelayedTimers();
});
```

---

## 🔍 故障排查

### 测试失败：API_KEYS 不能为空

**问题**: 测试运行时提示配置验证失败

**解决**:
```bash
# 确保 .env.test 文件存在
cat .env.test

# 手动复制配置（Windows 使用 copy）
cp .env.test .env

# 或者直接运行测试（自动复制）
npm test
```

### 测试失败：时间相关测试不稳定

**问题**: Cooldown 边界测试偶尔失败

**原因**: 毫秒级时间精度问题

**解决**:
```javascript
// 添加缓冲时间
const lastReset = new Date(Date.now() - 5 * 60 * 60 * 1000 - 1000); // +1秒缓冲

// 或使用范围断言
assert.ok(result.remaining < 2000, 'Should have ~1 second remaining');
```

### 测试失败：定时器未清理

**问题**: 测试完成后仍有定时器运行

**解决**:
```javascript
// 每个测试后清理定时器
service.clearDelayedTimers();

// 或在 afterEach 中统一清理
afterEach(() => {
  service.clearDelayedTimers();
  apiClient.reset();
});
```

### 依赖未安装

**问题**: Cannot find module 'dayjs'

**解决**:
```bash
pnpm install
```

---

## 📊 测试报告

运行测试后的典型输出：

```
🧪 88code Reset Service - 测试套件

运行测试文件：
  - ./tests/unit/ResetService.test.js
  - ./tests/unit/TimeUtils.test.js
  - ./tests/unit/DynamicTimerManager.test.js
  - ./tests/integration/reset-flow.test.js

TAP version 13
✅ ResetService tests defined
✅ TimeUtils tests defined
✅ DynamicTimerManager tests defined
✅ Integration tests defined

# tests 45
# suites 15
# pass 42
# fail 0
# duration_ms 1234.56
```

---

## 🎓 最佳实践

### 1. 测试隔离

每个测试使用独立的 Mock 实例：

```javascript
function createTestResetService() {
  const apiClient = new APIClientMock();
  const service = new ResetService(apiClient);
  service.notifierManager = new NotifierManagerMock();
  return { service, apiClient };
}
```

### 2. 数据驱动测试

使用测试夹具避免重复代码：

```javascript
const testCases = [
  { resetTimes: 0, resetType: RESET_TYPES.FIRST, expected: false },
  { resetTimes: 1, resetType: RESET_TYPES.FIRST, expected: false },
  { resetTimes: 2, resetType: RESET_TYPES.FIRST, expected: true },
];

for (const { resetTimes, resetType, expected } of testCases) {
  const sub = toAPIFormat(createIdealSubscription({ resetTimes }));
  const result = service.isEligible(sub, resetType);
  assert.strictEqual(result, expected);
}
```

### 3. 清理资源

始终清理测试资源：

```javascript
afterEach(() => {
  service.clearDelayedTimers();
  apiClient.reset();
  storage.clear();
  notifier.clear();
});
```

### 4. 描述性断言

使用清晰的错误消息：

```javascript
assert.strictEqual(
  result.eligible,
  3,
  'Should have 3 eligible subscriptions (resetTimes >= 2)'
);
```

---

## 📚 参考资料

- [Node.js Test Runner](https://nodejs.org/api/test.html) - 官方测试框架文档
- [TAP Protocol](https://testanything.org/) - 测试输出协议
- [Mock 设计模式](https://en.wikipedia.org/wiki/Mock_object) - Mock 对象模式

---

## 🤝 贡献指南

添加新测试时请遵循：

1. **命名规范**: `描述性动词 + 预期结果`
   ```javascript
   it('应该跳过 PAYGO 订阅', async () => { ... });
   ```

2. **测试结构**: Arrange → Act → Assert
   ```javascript
   // Arrange: 准备测试数据
   const subscriptions = [createPaygoSubscription()];

   // Act: 执行操作
   const result = await service.executeReset(RESET_TYPES.FIRST);

   // Assert: 验证结果
   assert.strictEqual(result.eligible, 0);
   ```

3. **覆盖边界**: 正常情况 + 边界情况 + 异常情况

4. **清理资源**: 使用 `afterEach` 或手动清理

---

**最后更新**: 2025-11-07
**测试框架**: Node.js Test Runner (内置)
**Mock 策略**: 纯 JavaScript Mock（零依赖）
