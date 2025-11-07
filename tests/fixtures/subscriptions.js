/**
 * 测试夹具 - 模拟各种订阅状态
 *
 * 核心数据结构：
 * - subscription_id: 唯一标识
 * - plan_type: PAYGO | MONTHLY | YEARLY
 * - active: true | false
 * - last_reset_at: ISO 时间字符串
 * - resetTimes: 0 | 1 | 2 | 3
 */

import dayjs from 'dayjs';

// 快速时间生成 - 从现在算起
const now = () => dayjs();
const hoursAgo = (hours) => now().subtract(hours, 'hour').toISOString();
const minutesAgo = (minutes) => now().subtract(minutes, 'minute').toISOString();

/**
 * 理想订阅 - 应该被重置
 */
export const createIdealSubscription = (overrides = {}) => ({
  subscription_id: 'sub-ideal-001',
  user_id: 'user-001',
  plan_type: 'MONTHLY',
  active: true,
  last_reset_at: hoursAgo(6), // 6小时前，cooldown已过
  resetTimes: 2,
  created_at: hoursAgo(720), // 30天前创建
  ...overrides,
});

/**
 * PAYGO 订阅 - 永不重置（P0优先级）
 */
export const createPaygoSubscription = (overrides = {}) => ({
  subscription_id: 'sub-paygo-001',
  user_id: 'user-002',
  plan_type: 'PAYGO',
  active: true,
  last_reset_at: hoursAgo(10),
  resetTimes: 0,
  created_at: hoursAgo(240),
  ...overrides,
});

/**
 * Inactive 订阅 - 应该跳过
 */
export const createInactiveSubscription = (overrides = {}) => ({
  subscription_id: 'sub-inactive-001',
  user_id: 'user-003',
  plan_type: 'MONTHLY',
  active: false,
  last_reset_at: hoursAgo(10),
  resetTimes: 2,
  created_at: hoursAgo(360),
  ...overrides,
});

/**
 * Cooldown 未过期订阅 - 需要延迟或跳过
 */
export const createCooldownPendingSubscription = (overrides = {}) => ({
  subscription_id: 'sub-cooldown-001',
  user_id: 'user-004',
  plan_type: 'MONTHLY',
  active: true,
  last_reset_at: hoursAgo(3), // 3小时前，cooldown还有2小时
  resetTimes: 2,
  created_at: hoursAgo(480),
  ...overrides,
});

/**
 * resetTimes = 0 的订阅 - 第一次重置前
 */
export const createFreshSubscription = (overrides = {}) => ({
  subscription_id: 'sub-fresh-001',
  user_id: 'user-005',
  plan_type: 'MONTHLY',
  active: true,
  last_reset_at: null,
  resetTimes: 0,
  created_at: hoursAgo(24),
  ...overrides,
});

/**
 * resetTimes = 1 的订阅 - 已重置一次
 */
export const createOnceResetSubscription = (overrides = {}) => ({
  subscription_id: 'sub-once-001',
  user_id: 'user-006',
  plan_type: 'MONTHLY',
  active: true,
  last_reset_at: hoursAgo(6),
  resetTimes: 1,
  created_at: hoursAgo(360),
  ...overrides,
});

/**
 * resetTimes = 3 的订阅 - 已达上限
 */
export const createMaxResetSubscription = (overrides = {}) => ({
  subscription_id: 'sub-max-001',
  user_id: 'user-007',
  plan_type: 'MONTHLY',
  active: true,
  last_reset_at: hoursAgo(1),
  resetTimes: 3,
  created_at: hoursAgo(720),
  ...overrides,
});

/**
 * YEARLY 类型订阅 - 应该跳过（只处理MONTHLY）
 */
export const createYearlySubscription = (overrides = {}) => ({
  subscription_id: 'sub-yearly-001',
  user_id: 'user-008',
  plan_type: 'YEARLY',
  active: true,
  last_reset_at: hoursAgo(10),
  resetTimes: 1,
  created_at: hoursAgo(8760), // 365天前
  ...overrides,
});

/**
 * 边界情况：刚好过了 cooldown（5小时1分钟前）
 */
export const createJustPassedCooldownSubscription = (overrides = {}) => ({
  subscription_id: 'sub-just-passed-001',
  user_id: 'user-009',
  plan_type: 'MONTHLY',
  active: true,
  last_reset_at: dayjs().subtract(5, 'hour').subtract(1, 'minute').toISOString(),
  resetTimes: 2,
  created_at: hoursAgo(240),
  ...overrides,
});

/**
 * 边界情况：刚好没过 cooldown（4小时59分钟前）
 */
export const createJustBeforeCooldownSubscription = (overrides = {}) => ({
  subscription_id: 'sub-just-before-001',
  user_id: 'user-010',
  plan_type: 'MONTHLY',
  active: true,
  last_reset_at: dayjs().subtract(5, 'hour').add(1, 'minute').toISOString(),
  resetTimes: 2,
  created_at: hoursAgo(240),
  ...overrides,
});

/**
 * 批量生成订阅列表
 */
export const createSubscriptionList = () => [
  createIdealSubscription(),
  createPaygoSubscription(),
  createInactiveSubscription(),
  createCooldownPendingSubscription(),
  createFreshSubscription(),
  createOnceResetSubscription(),
  createMaxResetSubscription(),
  createYearlySubscription(),
  createJustPassedCooldownSubscription(),
  createJustBeforeCooldownSubscription(),
];

/**
 * 创建符合 FIRST checkpoint 规则的订阅
 * FIRST: 只重置 resetTimes == 2 的
 */
export const createFirstCheckpointEligible = () => [
  createIdealSubscription({ subscription_id: 'first-eligible-001', resetTimes: 2 }),
  createIdealSubscription({ subscription_id: 'first-eligible-002', resetTimes: 2, last_reset_at: hoursAgo(10) }),
];

export const createFirstCheckpointIneligible = () => [
  createIdealSubscription({ subscription_id: 'first-skip-001', resetTimes: 0 }),
  createIdealSubscription({ subscription_id: 'first-skip-002', resetTimes: 1 }),
  // 注意：resetTimes=3 也符合 FIRST checkpoint 条件（>=2），所以不包含在这里
];

/**
 * 创建符合 SECOND checkpoint 规则的订阅
 * SECOND: 重置 resetTimes >= 1 的
 */
export const createSecondCheckpointEligible = () => [
  createIdealSubscription({ subscription_id: 'second-eligible-001', resetTimes: 1 }),
  createIdealSubscription({ subscription_id: 'second-eligible-002', resetTimes: 2 }),
  createIdealSubscription({ subscription_id: 'second-eligible-003', resetTimes: 3, last_reset_at: hoursAgo(6) }),
];

export const createSecondCheckpointIneligible = () => [
  createIdealSubscription({ subscription_id: 'second-skip-001', resetTimes: 0 }),
];

/**
 * 时间工具导出 - 方便测试中使用
 */
export const timeHelpers = {
  now,
  hoursAgo,
  minutesAgo,
};
