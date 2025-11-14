/**
 * TimeUtils 测试 - Cooldown 和时间计算
 *
 * 测试场景：
 * 1. Cooldown 检查逻辑
 * 2. 边界时间处理
 * 3. 时间格式化
 * 4. Cron 表达式生成
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import TimeUtils from '../../src/utils/TimeUtils.js';
import dayjs from 'dayjs';

// 辅助函数：生成过去的时间
const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();
const secondsAgo = (seconds) => new Date(Date.now() - seconds * 1000).toISOString();

describe('TimeUtils - Cooldown 检查', () => {
  it('应该检测 cooldown 已过（6小时前）', () => {
    const lastReset = hoursAgo(6);
    const result = TimeUtils.checkCooldown(lastReset);

    assert.strictEqual(result.passed, true, 'Should pass cooldown after 6 hours');
    assert.strictEqual(result.remaining, 0, 'Should have no remaining time');
  });

  it('应该检测 cooldown 未过（3小时前）', () => {
    const lastReset = hoursAgo(3);
    const result = TimeUtils.checkCooldown(lastReset);

    assert.strictEqual(result.passed, false, 'Should not pass cooldown after 3 hours');
    assert.ok(result.remaining > 0, 'Should have remaining time');
    assert.ok(result.formatted.includes('小时'), 'Should format remaining time with hours');
  });

  it('应该处理边界情况：刚好 5 小时', () => {
    // 注意：这个测试可能因为毫秒级误差而不稳定
    // 测试 5 小时 + 1 秒（确保已过）
    const lastReset = new Date(Date.now() - 5 * 60 * 60 * 1000 - 1000).toISOString();
    const result = TimeUtils.checkCooldown(lastReset);

    assert.strictEqual(result.passed, true, 'Should pass after 5 hours + 1 second');
  });

  it('应该处理边界情况：差一秒到 5 小时', () => {
    // 5 小时 - 1 秒（未过）
    const lastReset = new Date(Date.now() - 5 * 60 * 60 * 1000 + 1000).toISOString();
    const result = TimeUtils.checkCooldown(lastReset);

    assert.strictEqual(result.passed, false, 'Should not pass 1 second before 5 hours');
    assert.ok(result.remaining > 0 && result.remaining < 2000, 'Should have ~1 second remaining');
  });

  it('应该处理 null 或空的 lastResetTime', () => {
    const testCases = [null, undefined, ''];

    for (const input of testCases) {
      const result = TimeUtils.checkCooldown(input);
      assert.strictEqual(
        result.passed,
        true,
        `Should pass cooldown for ${input === null ? 'null' : input === undefined ? 'undefined' : 'empty string'}`
      );
    }
  });

  it('应该处理无效的时间字符串', () => {
    const invalidTimes = ['invalid-date', '2025-13-45', 'not-a-date'];

    for (const invalid of invalidTimes) {
      const result = TimeUtils.checkCooldown(invalid);
      assert.strictEqual(
        result.passed,
        true,
        `Should default to passed for invalid time: ${invalid}`
      );
    }
  });

  it('应该计算 cooldown 结束时间', () => {
    const lastReset = hoursAgo(3);
    const endTime = TimeUtils.getCooldownEndTime(lastReset);

    assert.ok(endTime > Date.now(), 'End time should be in the future');

    const expectedEndTime = new Date(lastReset).getTime() + 5 * 60 * 60 * 1000;
    const diff = Math.abs(endTime - expectedEndTime);

    assert.ok(diff < 100, 'End time should match expected (within 100ms)');
  });

  it('应该返回 0 当无法解析 cooldown 结束时间', () => {
    const testCases = [null, undefined, '', 'invalid'];

    for (const input of testCases) {
      const endTime = TimeUtils.getCooldownEndTime(input);
      assert.strictEqual(endTime, 0, `Should return 0 for: ${input}`);
    }
  });

  it('应该把无时区的 API 时间视为上海时间', () => {
    const apiTime = '2025-11-14 14:09:09';
    const mockNow = dayjs('2025-11-14T20:09:09+08:00');
    const originalNowFn = TimeUtils.nowInApiTimezone;

    try {
      TimeUtils.nowInApiTimezone = () => mockNow;
      const cooldown = TimeUtils.checkCooldown(apiTime);
      assert.strictEqual(cooldown.passed, true, '6 小时后应视为冷却结束');
    } finally {
      TimeUtils.nowInApiTimezone = originalNowFn;
    }
  });
});

describe('TimeUtils - 时间格式化', () => {
  it('应该正确格式化时长：小时', () => {
    const ms = 2 * 60 * 60 * 1000 + 30 * 60 * 1000; // 2小时30分
    const formatted = TimeUtils.formatDuration(ms);

    assert.ok(formatted.includes('2小时'), 'Should contain hours');
    assert.ok(formatted.includes('30分钟'), 'Should contain minutes');
  });

  it('应该正确格式化时长：分钟', () => {
    const ms = 5 * 60 * 1000 + 45 * 1000; // 5分45秒
    const formatted = TimeUtils.formatDuration(ms);

    assert.ok(formatted.includes('5分钟'), 'Should contain minutes');
    assert.ok(formatted.includes('45秒'), 'Should contain seconds');
  });

  it('应该正确格式化时长：秒', () => {
    const ms = 30 * 1000; // 30秒
    const formatted = TimeUtils.formatDuration(ms);

    assert.ok(formatted.includes('30秒'), 'Should contain seconds only');
  });

  it('应该格式化日期时间到上海时区', () => {
    const date = new Date('2025-11-07T12:30:00Z');
    const formatted = TimeUtils.formatDateTime(date);

    assert.strictEqual(formatted, '2025-11-07 20:30:00');
  });

  it('应该保持无时区字符串与 API 一致', () => {
    const apiTime = '2025-11-14 14:09:09';
    const formatted = TimeUtils.formatDateTime(apiTime);

    assert.strictEqual(formatted, apiTime);
  });

  it('应该处理无效日期', () => {
    const formatted = TimeUtils.formatDateTime('invalid-date');
    assert.strictEqual(formatted, '无效日期', 'Should return error message for invalid date');
  });
});

describe('TimeUtils - Cron 表达式', () => {
  it('应该解析时间字符串', () => {
    const testCases = [
      { input: '18:55', expected: { hour: 18, minute: 55 } },
      { input: '23:58', expected: { hour: 23, minute: 58 } },
      { input: '00:00', expected: { hour: 0, minute: 0 } },
      { input: '12:30', expected: { hour: 12, minute: 30 } },
    ];

    for (const { input, expected } of testCases) {
      const result = TimeUtils.parseCronTime(input);
      assert.deepStrictEqual(result, expected, `Should parse ${input} correctly`);
    }
  });

  it('应该生成正确的 Cron 表达式', () => {
    const testCases = [
      { input: '18:55', expected: '55 18 * * *' },
      { input: '23:58', expected: '58 23 * * *' },
      { input: '00:00', expected: '0 0 * * *' },
    ];

    for (const { input, expected } of testCases) {
      const cron = TimeUtils.toCronExpression(input);
      assert.strictEqual(cron, expected, `Should generate correct cron for ${input}`);
    }
  });

  it('应该拒绝无效的时间格式', () => {
    const invalidTimes = ['25:00', '12:60', 'invalid', '12', ':30', '12:'];

    for (const invalid of invalidTimes) {
      assert.throws(
        () => TimeUtils.parseCronTime(invalid),
        Error,
        `Should throw error for: ${invalid}`
      );
    }
  });

  it('应该拒绝超出范围的值', () => {
    const outOfRange = ['24:00', '12:60', '-1:30', '12:-1'];

    for (const invalid of outOfRange) {
      assert.throws(
        () => TimeUtils.parseCronTime(invalid),
        Error,
        `Should throw error for out of range: ${invalid}`
      );
    }
  });
});

describe('TimeUtils - 下次执行时间计算', () => {
  it('应该计算距离下次执行的时间', () => {
    const timeStr = '23:58';
    const millis = TimeUtils.getMillisUntilNext(timeStr);

    assert.ok(millis > 0, 'Should return positive milliseconds');
    assert.ok(millis <= 24 * 60 * 60 * 1000, 'Should be within 24 hours');
  });

  it('应该处理已过的时间（返回明天的时间）', () => {
    // 使用当前时间的前一小时
    const now = dayjs();
    const pastTime = now.subtract(1, 'hour').format('HH:mm');
    const millis = TimeUtils.getMillisUntilNext(pastTime);

    // 应该返回接近 23 小时的值
    assert.ok(millis > 22 * 60 * 60 * 1000, 'Should schedule for tomorrow');
    assert.ok(millis <= 24 * 60 * 60 * 1000, 'Should be within 24 hours');
  });
});

describe('TimeUtils - 今日日期', () => {
  it('应该返回今天的日期字符串', () => {
    const today = TimeUtils.getTodayDateString();

    assert.ok(today.match(/^\d{4}-\d{2}-\d{2}$/), 'Should match YYYY-MM-DD format');
  });
});

console.log('✅ TimeUtils tests defined');
