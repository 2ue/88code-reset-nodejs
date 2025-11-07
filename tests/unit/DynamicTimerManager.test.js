/**
 * DynamicTimerManager 测试 - 定时器管理
 *
 * 测试场景：
 * 1. 设置和清除单个定时器
 * 2. 同名定时器自动覆盖
 * 3. 批量清除所有定时器
 * 4. 定时器触发验证
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import DynamicTimerManager from '../../src/core/DynamicTimerManager.js';
import { wait } from '../mocks/TimeMock.js';

describe('DynamicTimerManager - 基础操作', () => {
  it('应该设置定时器', () => {
    const manager = new DynamicTimerManager();
    const timer = setTimeout(() => {}, 1000);

    manager.set('test-timer', timer);

    assert.strictEqual(manager.has('test-timer'), true, 'Timer should be set');
    assert.strictEqual(manager.getCount(), 1, 'Should have 1 timer');

    // 清理
    manager.clear('test-timer');
  });

  it('应该清除指定定时器', () => {
    const manager = new DynamicTimerManager();
    const timer = setTimeout(() => {}, 1000);

    manager.set('test-timer', timer);
    manager.clear('test-timer');

    assert.strictEqual(manager.has('test-timer'), false, 'Timer should be cleared');
    assert.strictEqual(manager.getCount(), 0, 'Should have 0 timers');
  });

  it('应该允许清除不存在的定时器（无错误）', () => {
    const manager = new DynamicTimerManager();

    // 不应该抛出错误
    assert.doesNotThrow(() => {
      manager.clear('non-existent');
    });
  });

  it('应该返回正确的定时器数量', () => {
    const manager = new DynamicTimerManager();

    assert.strictEqual(manager.getCount(), 0, 'Initial count should be 0');

    manager.set('timer-1', setTimeout(() => {}, 1000));
    manager.set('timer-2', setTimeout(() => {}, 1000));
    manager.set('timer-3', setTimeout(() => {}, 1000));

    assert.strictEqual(manager.getCount(), 3, 'Should have 3 timers');

    manager.clearAll();
    assert.strictEqual(manager.getCount(), 0, 'Should be 0 after clearAll');
  });
});

describe('DynamicTimerManager - 同名定时器覆盖', () => {
  it('应该自动清除旧的同名定时器', () => {
    const manager = new DynamicTimerManager();
    let timer1Executed = false;
    let timer2Executed = false;

    // 第一个定时器
    const timer1 = setTimeout(() => {
      timer1Executed = true;
    }, 50);

    manager.set('my-timer', timer1);
    assert.strictEqual(manager.getCount(), 1);

    // 设置同名定时器，应该清除旧的
    const timer2 = setTimeout(() => {
      timer2Executed = true;
    }, 50);

    manager.set('my-timer', timer2);

    // 仍然只有一个定时器
    assert.strictEqual(manager.getCount(), 1, 'Should still have only 1 timer');
    assert.strictEqual(manager.has('my-timer'), true);

    // 清理
    manager.clearAll();
  });

  it('应该防止定时器泄漏', () => {
    const manager = new DynamicTimerManager();

    // 反复设置同名定时器
    for (let i = 0; i < 10; i++) {
      const timer = setTimeout(() => {}, 1000);
      manager.set('repeating-timer', timer);
    }

    // 应该只有一个定时器
    assert.strictEqual(manager.getCount(), 1, 'Should not leak timers');

    manager.clearAll();
  });
});

describe('DynamicTimerManager - 批量清除', () => {
  it('应该清除所有定时器', () => {
    const manager = new DynamicTimerManager();

    // 设置多个定时器
    manager.set('timer-1', setTimeout(() => {}, 1000));
    manager.set('timer-2', setTimeout(() => {}, 1000));
    manager.set('timer-3', setTimeout(() => {}, 1000));

    assert.strictEqual(manager.getCount(), 3);

    manager.clearAll();

    assert.strictEqual(manager.getCount(), 0, 'All timers should be cleared');
    assert.strictEqual(manager.has('timer-1'), false);
    assert.strictEqual(manager.has('timer-2'), false);
    assert.strictEqual(manager.has('timer-3'), false);
  });

  it('应该允许多次调用 clearAll', () => {
    const manager = new DynamicTimerManager();

    manager.set('timer-1', setTimeout(() => {}, 1000));
    manager.clearAll();

    // 不应该抛出错误
    assert.doesNotThrow(() => {
      manager.clearAll();
    });
  });
});

describe('DynamicTimerManager - 定时器执行验证', () => {
  it('应该允许定时器正常执行', async () => {
    const manager = new DynamicTimerManager();
    let executed = false;

    const timer = setTimeout(() => {
      executed = true;
    }, 50);

    manager.set('exec-timer', timer);

    // 等待定时器执行
    await wait(100);

    assert.strictEqual(executed, true, 'Timer should execute');

    // 执行后定时器仍在管理器中（需要手动清除）
    assert.strictEqual(manager.has('exec-timer'), true);

    manager.clearAll();
  });

  it('清除定时器应该阻止其执行', async () => {
    const manager = new DynamicTimerManager();
    let executed = false;

    const timer = setTimeout(() => {
      executed = true;
    }, 50);

    manager.set('cancel-timer', timer);
    manager.clear('cancel-timer');

    // 等待足够时间
    await wait(100);

    assert.strictEqual(executed, false, 'Cancelled timer should not execute');
  });

  it('应该正确处理多个定时器的执行', async () => {
    const manager = new DynamicTimerManager();
    const results = [];

    manager.set(
      'timer-1',
      setTimeout(() => results.push('A'), 30)
    );
    manager.set(
      'timer-2',
      setTimeout(() => results.push('B'), 60)
    );
    manager.set(
      'timer-3',
      setTimeout(() => results.push('C'), 90)
    );

    // 等待所有定时器执行
    await wait(120);

    assert.deepStrictEqual(results, ['A', 'B', 'C'], 'All timers should execute in order');

    manager.clearAll();
  });
});

describe('DynamicTimerManager - 边界情况', () => {
  it('应该处理立即执行的定时器（delay=0）', async () => {
    const manager = new DynamicTimerManager();
    let executed = false;

    const timer = setTimeout(() => {
      executed = true;
    }, 0);

    manager.set('immediate', timer);

    // 等待事件循环
    await wait(10);

    assert.strictEqual(executed, true, 'Immediate timer should execute');
    manager.clearAll();
  });

  it('应该支持多次设置和清除同一个名称', () => {
    const manager = new DynamicTimerManager();

    for (let i = 0; i < 5; i++) {
      manager.set('cycle-timer', setTimeout(() => {}, 1000));
      assert.strictEqual(manager.has('cycle-timer'), true);

      manager.clear('cycle-timer');
      assert.strictEqual(manager.has('cycle-timer'), false);
    }

    assert.strictEqual(manager.getCount(), 0);
  });

  it('应该支持不同命名空间的定时器', () => {
    const manager = new DynamicTimerManager();

    manager.set('delayed-reset-sub-1', setTimeout(() => {}, 1000));
    manager.set('delayed-reset-sub-2', setTimeout(() => {}, 1000));
    manager.set('delayed-reset-sub-3', setTimeout(() => {}, 1000));

    assert.strictEqual(manager.getCount(), 3, 'Should manage multiple named timers');

    manager.clear('delayed-reset-sub-2');
    assert.strictEqual(manager.getCount(), 2, 'Should remove specific timer');

    manager.clearAll();
  });
});

console.log('✅ DynamicTimerManager tests defined');
