/**
 * 集成测试 - 完整重置流程
 *
 * 测试场景：
 * 1. FIRST checkpoint 完整流程
 * 2. SECOND checkpoint 完整流程
 * 3. 延迟重置的调度
 * 4. 多种订阅状态的混合处理
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ResetService } from '../../src/core/ResetService.js';
import { APIClientMock } from '../mocks/APIClientMock.js';
import { NotifierManagerMock } from '../mocks/StorageMock.js';
import { wait } from '../mocks/TimeMock.js';
import {
  createIdealSubscription,
  createPaygoSubscription,
  createInactiveSubscription,
  createCooldownPendingSubscription,
  createFreshSubscription,
  createOnceResetSubscription,
  createMaxResetSubscription,
} from '../fixtures/subscriptions.js';
import { RESET_TYPES, RESET_STATUS } from '../../src/constants.js';

/**
 * 将测试订阅转换为 API 格式
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
    currentCredits: 50,
    created_at: subscription.created_at,
  };
}

describe('集成测试 - FIRST Checkpoint 完整流程', () => {
  it('应该完成完整的 FIRST checkpoint 重置流程', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    // 准备测试数据：混合各种状态的订阅
    const subscriptions = [
      createIdealSubscription({ subscription_id: 'eligible-1', resetTimes: 2 }), // 应该重置
      createIdealSubscription({ subscription_id: 'eligible-2', resetTimes: 2 }), // 应该重置
      createPaygoSubscription({ subscription_id: 'paygo-1' }), // 跳过：PAYGO
      createInactiveSubscription({ subscription_id: 'inactive-1' }), // 跳过：未激活
      createFreshSubscription({ subscription_id: 'fresh-1' }), // 跳过：resetTimes=0
      createOnceResetSubscription({ subscription_id: 'once-1' }), // 跳过：resetTimes=1
      // 注意：不包含 resetTimes=3 的订阅，因为它也会被重置
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    // 执行重置
    const result = await service.executeReset(RESET_TYPES.FIRST);

    // 验证结果统计
    assert.strictEqual(result.totalSubscriptions, 6, 'Should process all subscriptions');
    assert.strictEqual(result.eligible, 2, 'Should have 2 eligible (resetTimes >= 2)');
    assert.strictEqual(result.success, 2, 'Should successfully reset 2 subscriptions');
    assert.strictEqual(result.failed, 0, 'Should have no failures');
    assert.strictEqual(result.skipped, 0, 'FIRST checkpoint does not use skipped status');
    assert.strictEqual(result.scheduled, 0, 'FIRST checkpoint does not schedule delays');

    // 验证 API 调用
    assert.strictEqual(apiClient.resetCallCount, 2, 'Should call reset API 2 times');

    // 验证详细结果
    const successfulResets = result.details.filter((d) => d.status === RESET_STATUS.SUCCESS);
    assert.strictEqual(successfulResets.length, 2);

    // 验证通知发送
    assert.strictEqual(
      service.notifierManager.sendCallCount,
      1,
      'Should send one notification'
    );

    // 清理
    service.clearDelayedTimers();
  });

  it('应该正确过滤 cooldown 未过的订阅（FIRST）', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    const subscriptions = [
      createCooldownPendingSubscription({ subscription_id: 'cooldown-1', resetTimes: 2 }), // cooldown 未过
      createIdealSubscription({ subscription_id: 'eligible-1', resetTimes: 2 }), // cooldown 已过
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    // FIRST checkpoint 直接过滤掉 cooldown 未过的订阅
    assert.strictEqual(result.eligible, 1, 'Should only have 1 eligible');
    assert.strictEqual(result.success, 1, 'Should reset only 1');
    assert.strictEqual(apiClient.resetCallCount, 1);

    service.clearDelayedTimers();
  });
});

describe('集成测试 - SECOND Checkpoint 完整流程', () => {
  it('应该完成完整的 SECOND checkpoint 重置流程', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    const subscriptions = [
      createIdealSubscription({ subscription_id: 'eligible-1', resetTimes: 1 }), // 应该重置
      createIdealSubscription({ subscription_id: 'eligible-2', resetTimes: 2 }), // 应该重置
      createIdealSubscription({ subscription_id: 'eligible-3', resetTimes: 3 }), // 应该重置
      createFreshSubscription({ subscription_id: 'fresh-1' }), // 跳过：resetTimes=0
      createPaygoSubscription({ subscription_id: 'paygo-1' }), // 跳过：PAYGO
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.SECOND);

    // 验证结果
    assert.strictEqual(result.totalSubscriptions, 5);
    assert.strictEqual(result.eligible, 3, 'Should have 3 eligible (resetTimes >= 1)');
    assert.strictEqual(result.success, 3, 'Should successfully reset 3');
    assert.strictEqual(result.scheduled, 0, 'No delays needed (cooldown passed)');

    assert.strictEqual(apiClient.resetCallCount, 3);

    service.clearDelayedTimers();
  });

  it('应该调度延迟重置当 cooldown 未过（SECOND）', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    const subscriptions = [
      createCooldownPendingSubscription({ subscription_id: 'cooldown-1', resetTimes: 2 }), // 应该调度延迟
      createIdealSubscription({ subscription_id: 'eligible-1', resetTimes: 1 }), // 立即重置
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.SECOND);

    // 验证结果
    assert.strictEqual(result.eligible, 2, 'Both should be eligible');
    assert.strictEqual(result.success, 1, 'One immediate success');
    assert.strictEqual(result.scheduled, 1, 'One scheduled for later');

    // 只有一个立即调用 API
    assert.strictEqual(apiClient.resetCallCount, 1, 'Only immediate reset calls API');

    // 验证延迟定时器已设置
    assert.strictEqual(
      service.timerManager.has('delayed-reset-cooldown-1'),
      true,
      'Delayed timer should be set'
    );

    // 验证 scheduled 状态的详细信息
    const scheduledDetail = result.details.find((d) => d.status === RESET_STATUS.SCHEDULED);
    assert.ok(scheduledDetail, 'Should have scheduled detail');
    assert.ok(scheduledDetail.scheduledTime, 'Should have scheduled time');
    assert.ok(scheduledDetail.message.includes('已调度延迟重置'));

    // 清理
    service.clearDelayedTimers();
  });

  it('应该处理混合场景：立即重置 + 延迟重置 + 跳过', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    const subscriptions = [
      createIdealSubscription({ subscription_id: 'immediate-1', resetTimes: 2 }), // 立即重置
      createIdealSubscription({ subscription_id: 'immediate-2', resetTimes: 1 }), // 立即重置
      createCooldownPendingSubscription({ subscription_id: 'delayed-1', resetTimes: 2 }), // 延迟重置
      createCooldownPendingSubscription({ subscription_id: 'delayed-2', resetTimes: 1 }), // 延迟重置
      createFreshSubscription({ subscription_id: 'skip-1' }), // 跳过
      createPaygoSubscription({ subscription_id: 'skip-2' }), // 跳过
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.SECOND);

    // 验证统计
    assert.strictEqual(result.totalSubscriptions, 6);
    assert.strictEqual(result.eligible, 4, '4 eligible subscriptions');
    assert.strictEqual(result.success, 2, '2 immediate resets');
    assert.strictEqual(result.scheduled, 2, '2 delayed resets');

    // 立即重置只调用 2 次 API
    assert.strictEqual(apiClient.resetCallCount, 2);

    // 验证 2 个延迟定时器
    assert.strictEqual(service.timerManager.getCount(), 2, 'Should have 2 pending timers');

    service.clearDelayedTimers();
  });
});

describe('集成测试 - 错误处理', () => {
  it('应该处理 API 失败并继续处理其他订阅', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    const subscriptions = [
      createIdealSubscription({ subscription_id: 'fail-1', resetTimes: 2 }),
      createIdealSubscription({ subscription_id: 'success-1', resetTimes: 2 }),
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    // Mock: 第一次调用失败，第二次成功
    let callCount = 0;
    const originalResetCredits = apiClient.resetCredits.bind(apiClient);
    apiClient.resetCredits = async function (subId) {
      callCount++;
      if (callCount === 1) {
        throw new Error('Simulated API failure');
      }
      return originalResetCredits(subId);
    };

    const result = await service.executeReset(RESET_TYPES.FIRST);

    // 应该有 1 个成功，1 个失败
    assert.strictEqual(result.eligible, 2);
    assert.strictEqual(result.success, 1, 'One should succeed');
    assert.strictEqual(result.failed, 1, 'One should fail');

    // 验证失败详情
    const failedDetail = result.details.find((d) => d.status === RESET_STATUS.FAILED);
    assert.ok(failedDetail, 'Should have failed detail');
    assert.ok(failedDetail.error, 'Should record error message');

    service.clearDelayedTimers();
  });

  it('应该处理 getSubscriptions 失败', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    apiClient.mockGetSubscriptionsFailure(new Error('Network error'));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    // 应该返回错误结果
    assert.ok(result.error, 'Should have error field');
    assert.strictEqual(result.totalSubscriptions, 0);
    assert.strictEqual(result.eligible, 0);

    service.clearDelayedTimers();
  });
});

describe('集成测试 - 状态验证', () => {
  it('应该验证重置后的订阅状态', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    const subscriptions = [
      createIdealSubscription({ subscription_id: 'verify-1', resetTimes: 2 }),
    ];

    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    // 验证结果包含前后对比
    const detail = result.details[0];
    assert.ok(detail.beforeCredits !== null, 'Should record before credits');
    assert.ok(detail.afterCredits !== null, 'Should record after credits');
    assert.ok(detail.beforeResetTimes !== null, 'Should record before resetTimes');
    assert.ok(detail.afterResetTimes !== null, 'Should record after resetTimes');

    // resetTimes 应该减少（消耗一次重置机会）
    assert.strictEqual(
      detail.afterResetTimes,
      detail.beforeResetTimes - 1,
      'resetTimes should decrement (consume one reset)'
    );

    service.clearDelayedTimers();
  });

  it('应该记录执行时间和持续时间', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    const subscriptions = [createIdealSubscription({ resetTimes: 2 })];
    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    const result = await service.executeReset(RESET_TYPES.FIRST);

    assert.ok(result.startTime > 0, 'Should record start time');
    assert.ok(result.endTime > 0, 'Should record end time');
    assert.ok(result.totalDuration > 0, 'Should record duration');
    assert.ok(result.endTime >= result.startTime, 'End time should be after start time');

    service.clearDelayedTimers();
  });
});

describe('集成测试 - 通知系统', () => {
  it('应该发送通知给 NotifierManager', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    const subscriptions = [createIdealSubscription({ resetTimes: 2 })];
    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    await service.executeReset(RESET_TYPES.FIRST);

    // 验证通知发送
    const notifications = service.notifierManager.getAllNotifications();
    assert.strictEqual(notifications.length, 1, 'Should send one notification');

    const notification = notifications[0];
    assert.strictEqual(notification.resetType, RESET_TYPES.FIRST);
    assert.strictEqual(notification.success, 1);
    assert.ok(notification.details, 'Should include details');

    service.clearDelayedTimers();
  });

  it('应该处理通知发送失败', async () => {
    const apiClient = new APIClientMock();
    const service = new ResetService(apiClient);
    service.notifierManager = new NotifierManagerMock();

    // Mock 通知失败
    service.notifierManager.mockFailure();

    const subscriptions = [createIdealSubscription({ resetTimes: 2 })];
    apiClient.setSubscriptions(subscriptions.map(toAPIFormat));

    // 不应该抛出错误（通知失败不影响主流程）
    await assert.doesNotReject(async () => {
      await service.executeReset(RESET_TYPES.FIRST);
    });

    service.clearDelayedTimers();
  });
});

console.log('✅ Integration tests defined');
