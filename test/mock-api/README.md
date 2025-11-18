# Mock API 测试说明

## 快速开始

### 1. 启动Mock服务器

```bash
# 方法1: 直接启动（默认端口3888）
node test/mock-api/server.mjs

# 方法2: 指定端口
node test/mock-api/server.mjs 3999

# 方法3: 使用环境变量
MOCK_API_PORT=3999 node test/mock-api/server.mjs
```

### 2. 修改测试数据

编辑 `test/mock-api/test-data.json` 文件，服务器会自动重新加载。

### 3. 运行测试

使用测试配置启动服务：

```bash
# 使用测试环境配置
cp test/.env.test .env
npm start

# 或者手动触发检查点
npm run reset:first
npm run reset:second
```

## 测试数据配置

### 测试场景示例

#### 场景1: resetTimes=0（已用完重置次数）

```json
{
  "resetTimes": 0,
  "id": 35306,
  "subscriptionPlanName": "FREE",
  "currentCredits": -2.89,
  "lastCreditReset": "2025-11-18 10:00:00",
  "isActive": true
}
```

**预期行为**:
- 第一次检查点: 跳过（resetTimes < 2）
- 第二次检查点: 跳过（resetTimes < 1）
- 不会出现在通知中

#### 场景2: resetTimes=1（只能第二次重置）

```json
{
  "resetTimes": 1,
  "id": 35307,
  "subscriptionPlanName": "FREE",
  "currentCredits": -5.00,
  "lastCreditReset": "2025-11-18 10:00:00",
  "isActive": true
}
```

**预期行为**:
- 第一次检查点: 跳过（保留给第二次）
- 第二次检查点: 调用重置API
- 会出现在第二次检查点通知中

#### 场景3: resetTimes=2（两次都可以重置）

```json
{
  "resetTimes": 2,
  "id": 27233,
  "subscriptionPlanName": "PLUS",
  "currentCredits": 38.99,
  "lastCreditReset": "2025-11-18 12:00:00",
  "isActive": true
}
```

**预期行为**:
- 第一次检查点: 调用重置API
- 第二次检查点: 跳过（resetTimes已减为0）

#### 场景4: 冷却期内

```json
{
  "resetTimes": 2,
  "id": 30000,
  "subscriptionPlanName": "PLUS",
  "currentCredits": 20.00,
  "lastCreditReset": "2025-11-18 20:00:00",
  "isActive": true
}
```

**预期行为**:
- 如果当前时间 < lastCreditReset + 5小时: 跳过（冷却期内）
- 否则: 正常处理

## Mock服务器行为

### API端点

#### 获取订阅列表

```http
POST http://localhost:3888/api/subscription
```

返回 `test-data.json` 中的所有订阅。

#### 重置额度

```http
POST http://localhost:3888/api/reset-credits/{subscriptionId}
```

**行为**: 永远返回成功，但数据不变化

这模拟了真实场景：
- API调用成功
- 但订阅的 resetTimes、currentCredits 等数据不会改变
- 用于测试"API返回成功但数据未变化"的场景

## 常见测试场景

### 测试1: 验证resetTimes=0被正确过滤

1. 设置 `test-data.json` 中FREE订阅的 `resetTimes: 0`
2. 启动Mock服务器
3. 运行第一次和第二次检查点
4. 检查日志：应该显示"跳过"，不应该调用API

### 测试2: 验证冷却期检查

1. 设置 `lastCreditReset` 为当前时间（在5小时内）
2. 运行检查点
3. 检查日志：应该显示"冷却期内"

### 测试3: 验证通知内容

1. 确保 `ENABLE_LOCAL_FILE_NOTIFIER=true`
2. 运行检查点
3. 查看 `notifications/` 目录下的通知文件
4. 验证通知内容是否正确

## 热重载功能

Mock服务器支持热重载，修改 `test-data.json` 后：

1. 服务器自动检测文件变化
2. 重新加载数据
3. 无需重启服务器
4. 控制台会显示"检测到测试数据变化，重新加载..."

## 文件结构

```
test/mock-api/
├── server.mjs          # Mock API服务器
├── test-data.json      # 测试数据（可随时修改）
└── README.md           # 本文档
```
