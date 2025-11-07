/**
 * 时间 Mock - 加速 cooldown 测试
 *
 * 核心思想：
 * - 将真实的 5 小时 cooldown 压缩到可配置的短时间（如 5 秒）
 * - 所有时间计算保持比例一致
 * - 不修改源码，通过 mock 实现
 */

import dayjs from 'dayjs';

export class TimeMock {
  constructor(options = {}) {
    // 时间加速比例：默认 3600x (5小时 -> 5秒)
    this.speedMultiplier = options.speedMultiplier || 3600;

    // 模拟的"当前时间"基准
    this.mockedNow = options.baseTime || dayjs();

    // 是否启用时间 mock
    this.enabled = true;
  }

  /**
   * 获取当前时间（可能是 mock 的）
   */
  now() {
    return this.enabled ? this.mockedNow.clone() : dayjs();
  }

  /**
   * 推进时间
   */
  advance(amount, unit = 'second') {
    if (this.enabled) {
      this.mockedNow = this.mockedNow.add(amount, unit);
    }
  }

  /**
   * 快进到特定时间
   */
  setTime(time) {
    if (this.enabled) {
      this.mockedNow = dayjs(time);
    }
  }

  /**
   * 重置时间到初始值
   */
  reset(baseTime) {
    this.mockedNow = baseTime ? dayjs(baseTime) : dayjs();
  }

  /**
   * 启用/禁用时间 mock
   */
  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  /**
   * 创建加速的 cooldown 时间
   * 真实 5 小时 -> 加速后的时间
   */
  createAcceleratedCooldown(realHours = 5) {
    const acceleratedMs = (realHours * 3600 * 1000) / this.speedMultiplier;
    return acceleratedMs;
  }

  /**
   * 生成加速的过去时间
   */
  hoursAgo(hours) {
    const acceleratedHours = hours / this.speedMultiplier;
    return this.now().subtract(acceleratedHours, 'hour').toISOString();
  }

  minutesAgo(minutes) {
    const acceleratedMinutes = minutes / this.speedMultiplier;
    return this.now().subtract(acceleratedMinutes, 'minute').toISOString();
  }

  /**
   * 创建用于测试的 cooldown 配置
   */
  getCooldownConfig() {
    return {
      // 将 5 小时压缩到 5 秒（或其他配置的值）
      COOLDOWN_HOURS: 5 / this.speedMultiplier,
      COOLDOWN_PERIOD: this.createAcceleratedCooldown(5),
    };
  }
}

/**
 * 简化版 - 直接创建加速时间的工具函数
 */
export const createFastTime = (speedMultiplier = 3600) => {
  const timeMock = new TimeMock({ speedMultiplier });

  return {
    now: () => timeMock.now(),
    advance: (amount, unit) => timeMock.advance(amount, unit),
    setTime: (time) => timeMock.setTime(time),
    hoursAgo: (hours) => timeMock.hoursAgo(hours),
    minutesAgo: (minutes) => timeMock.minutesAgo(minutes),
    getCooldownMs: () => timeMock.createAcceleratedCooldown(5),
    reset: () => timeMock.reset(),
  };
};

/**
 * 创建 mock 定时器 - 用于测试延迟重置
 */
export class MockTimer {
  constructor(speedMultiplier = 3600) {
    this.speedMultiplier = speedMultiplier;
    this.timers = new Map();
    this.nextId = 1;
  }

  /**
   * 加速版 setTimeout
   */
  setTimeout(callback, delay) {
    const acceleratedDelay = delay / this.speedMultiplier;
    const id = this.nextId++;

    const timerId = setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, acceleratedDelay);

    this.timers.set(id, { timerId, callback, delay, acceleratedDelay });
    return id;
  }

  /**
   * 清除定时器
   */
  clearTimeout(id) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer.timerId);
      this.timers.delete(id);
    }
  }

  /**
   * 立即触发所有定时器（用于测试）
   */
  async flushAll() {
    const callbacks = Array.from(this.timers.values()).map((t) => t.callback);
    this.clearAll();

    // 按顺序执行所有回调
    for (const callback of callbacks) {
      await Promise.resolve(callback());
    }
  }

  /**
   * 清除所有定时器
   */
  clearAll() {
    for (const [id, timer] of this.timers) {
      clearTimeout(timer.timerId);
    }
    this.timers.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      activeTimers: this.timers.size,
      timers: Array.from(this.timers.entries()).map(([id, timer]) => ({
        id,
        delay: timer.delay,
        acceleratedDelay: timer.acceleratedDelay,
      })),
    };
  }
}

/**
 * 实用工具：等待指定时间
 */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 实用工具：等待加速时间
 */
export const waitAccelerated = (realMs, speedMultiplier = 3600) => {
  const acceleratedMs = realMs / speedMultiplier;
  return wait(acceleratedMs);
};
