/**
 * Storage Mock - 模拟文件存储
 *
 * 避免测试产生实际文件
 */

export class FileStorageMock {
  constructor() {
    this.storage = new Map(); // key: date, value: array of records
    this.saveCallCount = 0;
  }

  /**
   * 模拟保存重置历史
   */
  async saveResetHistory(data) {
    this.saveCallCount++;

    const date = new Date().toISOString().split('T')[0];
    if (!this.storage.has(date)) {
      this.storage.set(date, []);
    }

    this.storage.get(date).push({
      ...data,
      savedAt: new Date().toISOString(),
    });

    return true;
  }

  /**
   * 模拟读取历史记录
   */
  async getResetHistory(days = 7) {
    const allRecords = [];
    for (const [date, records] of this.storage.entries()) {
      allRecords.push(...records.map((r) => ({ date, ...r })));
    }

    // 返回最近 N 天的记录
    return allRecords.slice(-days * 10); // 假设每天最多10条
  }

  /**
   * 获取指定日期的记录
   */
  async getRecordsByDate(date) {
    return this.storage.get(date) || [];
  }

  /**
   * 清空存储
   */
  clear() {
    this.storage.clear();
    this.saveCallCount = 0;
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      saveCallCount: this.saveCallCount,
      totalDates: this.storage.size,
      totalRecords: Array.from(this.storage.values()).reduce(
        (sum, records) => sum + records.length,
        0
      ),
    };
  }

  /**
   * 获取所有记录（用于调试）
   */
  getAllRecords() {
    const records = {};
    for (const [date, data] of this.storage.entries()) {
      records[date] = data;
    }
    return records;
  }
}

/**
 * NotifierManager Mock - 模拟通知发送
 */
export class NotifierManagerMock {
  constructor() {
    this.notifications = [];
    this.sendCallCount = 0;
    this.shouldFail = false;
  }

  /**
   * 模拟发送通知
   */
  async notify(data) {
    this.sendCallCount++;

    if (this.shouldFail) {
      throw new Error('Notification failed');
    }

    this.notifications.push({
      ...data,
      sentAt: new Date().toISOString(),
    });

    return true;
  }

  /**
   * 模拟失败
   */
  mockFailure() {
    this.shouldFail = true;
  }

  /**
   * 恢复正常
   */
  mockSuccess() {
    this.shouldFail = false;
  }

  /**
   * 清空通知记录
   */
  clear() {
    this.notifications = [];
    this.sendCallCount = 0;
    this.shouldFail = false;
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      sendCallCount: this.sendCallCount,
      totalNotifications: this.notifications.length,
    };
  }

  /**
   * 获取所有通知（用于验证）
   */
  getAllNotifications() {
    return this.notifications;
  }

  /**
   * 获取最后一条通知
   */
  getLastNotification() {
    return this.notifications[this.notifications.length - 1];
  }
}
