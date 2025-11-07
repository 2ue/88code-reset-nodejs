/**
 * APIClient Mock - 模拟 API 调用
 *
 * 支持场景：
 * - 成功返回订阅列表
 * - 成功重置额度
 * - API 失败（4xx, 5xx）
 * - 网络超时
 * - 速率限制
 */

export class APIClientMock {
  constructor() {
    this.subscriptions = [];
    this.resetCallCount = 0;
    this.getSubscriptionsCallCount = 0;
    this.shouldFailReset = false;
    this.shouldFailGetSubscriptions = false;
    this.failureError = null;
    this.resetDelay = 0; // 模拟 API 延迟（ms）
    this.resetHistory = []; // 记录所有重置操作
  }

  /**
   * 设置 mock 数据
   */
  setSubscriptions(subscriptions) {
    this.subscriptions = subscriptions;
  }

  /**
   * 模拟获取订阅列表
   */
  async getSubscriptions() {
    this.getSubscriptionsCallCount++;

    if (this.shouldFailGetSubscriptions) {
      throw this.failureError || new Error('Failed to get subscriptions');
    }

    // 返回深拷贝，避免测试间相互影响
    return JSON.parse(JSON.stringify(this.subscriptions));
  }

  /**
   * 模拟重置额度
   */
  async resetCredits(subscriptionId) {
    this.resetCallCount++;
    this.resetHistory.push({
      subscriptionId,
      timestamp: new Date().toISOString(),
    });

    if (this.shouldFailReset) {
      throw this.failureError || new Error(`Failed to reset credits for ${subscriptionId}`);
    }

    // 模拟延迟
    if (this.resetDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.resetDelay));
    }

    // 更新订阅状态（模拟真实 API 行为）
    // 注意：需要用 id 字段匹配，因为 toAPIFormat 转换后使用 id
    const subscription = this.subscriptions.find((s) => s.id === subscriptionId);
    if (subscription) {
      subscription.lastCreditReset = new Date().toISOString();
      // resetTimes 应该减少（消耗一次重置机会），最小为 0
      subscription.resetTimes = Math.max((subscription.resetTimes || 0) - 1, 0);
    }

    return { success: true };
  }

  /**
   * 模拟获取使用情况
   */
  async getUsage(subscriptionId) {
    const subscription = this.subscriptions.find((s) => s.subscription_id === subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    return {
      subscription_id: subscriptionId,
      used_credits: 0,
      total_credits: 100,
      reset_at: subscription.last_reset_at,
    };
  }

  /**
   * 模拟失败场景
   */
  mockResetFailure(error) {
    this.shouldFailReset = true;
    this.failureError = error;
  }

  mockGetSubscriptionsFailure(error) {
    this.shouldFailGetSubscriptions = true;
    this.failureError = error;
  }

  /**
   * 模拟 API 延迟
   */
  setResetDelay(delayMs) {
    this.resetDelay = delayMs;
  }

  /**
   * 重置 mock 状态
   */
  reset() {
    this.subscriptions = [];
    this.resetCallCount = 0;
    this.getSubscriptionsCallCount = 0;
    this.shouldFailReset = false;
    this.shouldFailGetSubscriptions = false;
    this.failureError = null;
    this.resetDelay = 0;
    this.resetHistory = [];
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      resetCallCount: this.resetCallCount,
      getSubscriptionsCallCount: this.getSubscriptionsCallCount,
      resetHistory: this.resetHistory,
    };
  }
}

/**
 * 创建标准错误
 */
export const createAPIError = (statusCode, message) => {
  const error = new Error(message);
  error.response = {
    status: statusCode,
    data: { message },
  };
  return error;
};

/**
 * 常见错误场景
 */
export const APIErrors = {
  UNAUTHORIZED: createAPIError(401, 'Unauthorized'),
  FORBIDDEN: createAPIError(403, 'Forbidden'),
  NOT_FOUND: createAPIError(404, 'Not Found'),
  RATE_LIMIT: createAPIError(429, 'Too Many Requests'),
  SERVER_ERROR: createAPIError(500, 'Internal Server Error'),
  TIMEOUT: Object.assign(new Error('Request timeout'), { code: 'ECONNABORTED' }),
};
