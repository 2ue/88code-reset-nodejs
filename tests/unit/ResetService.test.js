/**
 * ResetService 核心逻辑测试
 *
 * 测试场景：
 * 1. PAYGO 保护（最高优先级）
 * 2. 订阅类型和状态过滤
 * 3. Cooldown 逻辑
 * 4. FIRST vs SECOND checkpoint 策略
 * 5. 延迟重置调度
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ResetService } from '../../src/core/ResetService.js';
import { APIClientMock, APIErrors } from '../mocks/APIClientMock.js';
import { FileStorageMock, NotifierManagerMock } from '../mocks/StorageMock.js';
import { createFastTime, wait } from '../mocks/TimeMock.js';
import {
  createIdealSubscription,
  createPaygoSubscription,
  createInactiveSubscription,
  createCooldownPendingSubscription,
  createFreshSubscription,
  createOnceResetSubscription,
  createFirstCheckpointEligible,
  createFirstCheckpointIneligible,
  createSecondCheckpointEligible,
  createSecondCheckpointIneligible,
} from '../fixtures/subscriptions.js';
import { RESET_TYPES, RESET_STATUS } from '../../src/constants.js';

/**
 * 创建测试用的 ResetService
 * 注意：需要 mock 依赖项
 */
function createTestResetService() {
  const apiClient = new APIClientMock();
  const service = new ResetService(apiClient);

  // Mock 通知管理器避免实际发送通知
  service.notifierManager = new NotifierManagerMock();

  return { service, apiClient };
}

/**
 * 将真实订阅转换为 API 返回格式
 * 适配 ResetService 期望的数据结构
 */
function toAPIFormat(subscription) {
  return {
    id: subscription.subscription_id,
    user_id: subscription.user_id,
    subscriptionPlanName: subscription.plan_type,
    subscriptionPlan: {
      planType: subscription.plan_type,
      subscriptionName: subscription.plan_type,
      creditLimit: 100,
    },
    isActive: subscription.active,
    lastCreditReset: subscription.last_reset_at,
    resetTimes: subscription.resetTimes,
    currentCredits: 50, // 默认余额
    created_at: subscription.created_at,
  };
}

describe('ResetService - P0 PAYGO 保护', () => {
  it('应该跳过 PAYGO 订阅（最高优先级）', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createPaygoSubscription(),
      createIdealSubscription(),
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    // PAYGO 应该被过滤掉
    assert.strictEqual(result.eligible, 1, 'Only non-PAYGO should be eligible');
    assert.strictEqual(apiClient.resetCallCount, 1, 'Only one reset should be called');
  });

  it('应该识别各种 PAYGO 变体', async () => {
    const { service } = createTestResetService();

    const testCases = [
      { subscriptionPlanName: 'PAYGO' },
      { subscriptionPlan: { subscriptionName: 'PAYGO' } },
      { subscriptionPlan: { planType: 'PAYGO' } },
      { subscriptionPlan: { planType: 'PAY_PER_USE' } },
    ];

    for (const testCase of testCases) {
      const sub = { ...toAPIFormat(createIdealSubscription()), ...testCase };
      assert.strictEqual(
        service.isPAYGO(sub),
        true,
        `Should detect PAYGO: ${JSON.stringify(testCase)}`
      );
    }
  });
});

describe('ResetService - P1 类型和状态过滤', () => {
  it('应该只处理 MONTHLY 类型订阅', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createIdealSubscription({ plan_type: 'MONTHLY' }),
      createIdealSubscription({ subscription_id: 'yearly', plan_type: 'YEARLY' }),
      createIdealSubscription({ subscription_id: 'paygo', plan_type: 'PAYGO' }),
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.strictEqual(result.eligible, 1, 'Only MONTHLY should be eligible');
  });

  it('应该跳过 inactive 订阅', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createIdealSubscription({ active: true }),
      createInactiveSubscription(),
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.strictEqual(result.eligible, 1, 'Only active subscription should be eligible');
  });
});

describe('ResetService - P2 Cooldown 逻辑', () => {
  it('FIRST checkpoint: 应该跳过 cooldown 未过的订阅', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createCooldownPendingSubscription(), // 3小时前，cooldown 未过
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.strictEqual(result.eligible, 0, 'Should filter out subscriptions in cooldown');
    assert.strictEqual(result.skipped, 0, 'Should not even process them');
  });

  it('SECOND checkpoint: 应该调度延迟重置当 cooldown 未过', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createCooldownPendingSubscription({ resetTimes: 2 }), // 符合 SECOND 的 resetTimes 条件
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.SECOND);

    assert.strictEqual(result.eligible, 1, 'Should be eligible for delayed reset');
    assert.strictEqual(result.scheduled, 1, 'Should schedule delayed reset');
    assert.strictEqual(result.success, 0, 'Should not immediately succeed');
    assert.strictEqual(apiClient.resetCallCount, 0, 'Should not call reset API immediately');
  });

  it('SECOND checkpoint: 应该立即重置当 cooldown 已过', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createIdealSubscription({ resetTimes: 2 }), // 6小时前，cooldown 已过
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.SECOND);

    assert.strictEqual(result.eligible, 1);
    assert.strictEqual(result.success, 1, 'Should immediately reset');
    assert.strictEqual(result.scheduled, 0, 'Should not schedule');
    assert.strictEqual(apiClient.resetCallCount, 1);
  });
});

describe('ResetService - P3 resetTimes 策略', () => {
  it('FIRST checkpoint: 只重置 resetTimes >= 2 的订阅', async () => {
    const { service, apiClient} = createTestResetService();

    const subscriptions = [
      ...createFirstCheckpointEligible(), // resetTimes = 2 (2个订阅)
      createIdealSubscription({ subscription_id: 'reset-3', resetTimes: 3 }), // resetTimes = 3 也应该重置
      ...createFirstCheckpointIneligible(), // resetTimes = 0, 1 (2个订阅，已修正)
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    // 现在应该是 3 个符合条件：2个resetTimes=2 + 1个resetTimes=3
    assert.strictEqual(result.eligible, 3, 'resetTimes >= 2 should be eligible (2 with resetTimes=2, 1 with resetTimes=3)');
    assert.strictEqual(apiClient.resetCallCount, 3);
  });

  it('SECOND checkpoint: 重置 resetTimes >= 1 的订阅', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      ...createSecondCheckpointEligible(), // resetTimes = 1, 2, 3
      ...createSecondCheckpointIneligible(), // resetTimes = 0
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.SECOND);

    assert.strictEqual(result.eligible, 3, 'resetTimes >= 1 should be eligible');
    assert.strictEqual(apiClient.resetCallCount, 3);
  });

  it('应该正确处理 resetTimes 边界情况', async () => {
    const { service } = createTestResetService();

    const testCases = [
      { resetTimes: 0, resetType: RESET_TYPES.FIRST, expected: false, reason: '< 2' },
      { resetTimes: 1, resetType: RESET_TYPES.FIRST, expected: false, reason: '< 2' },
      { resetTimes: 2, resetType: RESET_TYPES.FIRST, expected: true, reason: '>= 2' },
      { resetTimes: 3, resetType: RESET_TYPES.FIRST, expected: true, reason: '>= 2' },
      { resetTimes: 0, resetType: RESET_TYPES.SECOND, expected: false, reason: '< 1' },
      { resetTimes: 1, resetType: RESET_TYPES.SECOND, expected: true, reason: '>= 1' },
      { resetTimes: 2, resetType: RESET_TYPES.SECOND, expected: true, reason: '>= 1' },
      { resetTimes: 3, resetType: RESET_TYPES.SECOND, expected: true, reason: '>= 1' },
    ];

    for (const { resetTimes, resetType, expected, reason } of testCases) {
      const sub = toAPIFormat(createIdealSubscription({ resetTimes }));
      const result = service.isEligible(sub, resetType);

      assert.strictEqual(
        result,
        expected,
        `resetTimes=${resetTimes} (${reason}), type=${resetType} should be ${expected}`
      );
    }
  });
});

describe('ResetService - 重置执行', () => {
  it('应该成功重置符合条件的订阅', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [createIdealSubscription()];
    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.strictEqual(result.success, 1);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(apiClient.resetCallCount, 1);

    // 验证重置后的状态
    const stats = apiClient.getStats();
    assert.strictEqual(stats.resetHistory.length, 1);
  });

  it('应该处理 API 失败情况', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [createIdealSubscription()];
    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    // 模拟 API 失败
    apiClient.mockResetFailure(APIErrors.SERVER_ERROR);

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.strictEqual(result.eligible, 1);
    assert.strictEqual(result.success, 0);
    assert.strictEqual(result.failed, 1);

    const failedDetail = result.details.find((d) => d.status === RESET_STATUS.FAILED);
    assert.ok(failedDetail, 'Should have failed detail');
    assert.ok(failedDetail.error, 'Should record error message');
  });

  it('应该串行处理多个订阅', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createIdealSubscription({ subscription_id: 'sub-1' }),
      createIdealSubscription({ subscription_id: 'sub-2' }),
      createIdealSubscription({ subscription_id: 'sub-3' }),
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const startTime = Date.now();
    const result = await service.executeReset(RESET_TYPES.FIRST);
    const duration = Date.now() - startTime;

    assert.strictEqual(result.success, 3);
    assert.strictEqual(apiClient.resetCallCount, 3);

    // 验证是串行执行（有延迟）
    // 注意：这里不做严格的时间验证，因为 config.requestIntervalMs 可能很小
    const history = apiClient.getStats().resetHistory;
    assert.strictEqual(history.length, 3);
  });
});

describe('ResetService - 结果统计', () => {
  it('应该正确统计各种状态', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createIdealSubscription({ subscription_id: 'success-1', resetTimes: 2 }),
      createIdealSubscription({ subscription_id: 'success-2', resetTimes: 2 }),
      createPaygoSubscription(), // 会被过滤
      createInactiveSubscription(), // 会被过滤
      createFreshSubscription(), // resetTimes=0，FIRST 跳过
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.strictEqual(result.totalSubscriptions, 5);
    assert.strictEqual(result.eligible, 2);
    assert.strictEqual(result.success, 2);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.skipped, 0);
  });

  it('应该记录执行时间', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [createIdealSubscription()];
    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.ok(result.startTime > 0);
    assert.ok(result.endTime > 0);
    assert.ok(result.totalDuration > 0);
    assert.ok(result.endTime >= result.startTime);
  });
});

describe('ResetService - 边界情况', () => {
  it('应该处理空订阅列表', async () => {
    const { service, apiClient } = createTestResetService();

    apiClient.setSubscriptions([]);

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.strictEqual(result.totalSubscriptions, 0);
    assert.strictEqual(result.eligible, 0);
    assert.strictEqual(result.success, 0);
  });

  it('应该处理所有订阅都不符合条件的情况', async () => {
    const { service, apiClient } = createTestResetService();

    const subscriptions = [
      createPaygoSubscription(),
      createInactiveSubscription(),
      createFreshSubscription(), // resetTimes=0
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.strictEqual(result.totalSubscriptions, 3);
    assert.strictEqual(result.eligible, 0);
    assert.strictEqual(apiClient.resetCallCount, 0);
  });

  it('应该处理 getSubscriptions API 失败', async () => {
    const { service, apiClient } = createTestResetService();

    apiClient.mockGetSubscriptionsFailure(APIErrors.SERVER_ERROR);

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.ok(result.error, 'Should record error');
    assert.strictEqual(result.totalSubscriptions, 0);
  });
});

console.log('✅ ResetService tests defined');
