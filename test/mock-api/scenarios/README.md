# 测试场景管理

预定义的测试场景，用于快速切换不同的测试情况。

## 📋 可用场景

### 1. `scenario-resetTimes-0.json`
**resetTimes=0 - 已用完重置次数**
- FREE订阅，resetTimes=0
- 预期：两次检查点都应跳过
- 用途：验证P3检查逻辑

### 2. `scenario-resetTimes-1.json`
**resetTimes=1 - 只能第二次重置**
- FREE订阅，resetTimes=1
- 预期：第一次跳过，第二次重置
- 用途：验证重置次数保留策略

### 3. `scenario-resetTimes-2.json`
**resetTimes=2 - 两次都可以重置**
- PLUS订阅，resetTimes=2
- 预期：第一次重置，第二次跳过
- 用途：验证正常重置流程

### 4. `scenario-cooldown.json`
**冷却期内**
- PLUS订阅，lastCreditReset在5小时内
- 预期：应被跳过
- 用途：验证冷却期检查

### 5. `scenario-mixed.json`
**混合场景**
- 包含resetTimes=0/1/2的订阅
- 包含PAYGO（不参与重置）
- 预期：各种情况的综合测试
- 用途：完整功能测试

## 🚀 快速使用

### 方法1: 使用切换脚本（推荐）

```bash
# 列出所有场景
./test/mock-api/use-scenario.sh list

# 切换到指定场景
./test/mock-api/use-scenario.sh resetTimes-0

# 切换到混合场景
./test/mock-api/use-scenario.sh mixed
```

### 方法2: 手动复制

```bash
# 复制场景文件到test-data.json
cp test/mock-api/scenarios/scenario-resetTimes-0.json test/mock-api/test-data.json
```

## 🛠️ 生成自定义场景

使用场景生成器创建自定义测试数据：

```bash
# 生成resetTimes=0的场景
node test/mock-api/generate-scenario.mjs --resetTimes 0 --planName FREE

# 生成混合场景（resetTimes=0,1,2）
node test/mock-api/generate-scenario.mjs --resetTimes 0,1,2 --planName FREE

# 生成冷却期内的订阅
node test/mock-api/generate-scenario.mjs --cooldown --count 3

# 生成并保存为场景文件
node test/mock-api/generate-scenario.mjs --resetTimes 0 --save my-test

# 查看帮助
node test/mock-api/generate-scenario.mjs --help
```

## 📝 场景文件格式

每个场景文件都是一个JSON数组，包含一个或多个订阅对象：

```json
[
  {
    "resetTimes": 0,
    "id": 35306,
    "subscriptionPlanName": "FREE",
    "currentCredits": -2.89,
    "lastCreditReset": "2025-11-18 10:00:00",
    "isActive": true,
    "subscriptionPlan": {
      "subscriptionName": "FREE",
      "creditLimit": 20.25
    }
  }
]
```

## 💡 使用建议

1. **测试前先切换场景**
   ```bash
   ./test/mock-api/use-scenario.sh resetTimes-0
   ./test/run-test.sh both
   ```

2. **Mock服务器会自动重新加载数据**
   - 如果Mock服务器正在运行，切换场景后数据会自动生效
   - 无需重启服务器

3. **备份功能**
   - 切换场景时会自动备份当前的test-data.json
   - 备份文件：`test-data.json.backup`
   - 恢复备份：`cp test-data.json.backup test-data.json`

## 🔄 工作流程

```
选择场景 → 切换数据 → 运行测试 → 查看结果
    ↓           ↓          ↓          ↓
use-scenario  自动备份   run-test   notifications/
              自动重载   Mock API    日志文件
```

## 📚 相关文档

- [Mock API使用说明](../README.md)
- [测试框架总览](../../README.md)
- [场景生成器文档](../generate-scenario.mjs)
