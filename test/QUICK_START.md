# 测试框架快速参考

## 🎯 一键测试

```bash
# 完整测试（第一次+第二次检查点）
./test/run-test.sh both

# 只测第一次检查点
./test/run-test.sh first

# 只测第二次检查点
./test/run-test.sh second

# 守护进程模式
./test/run-test.sh daemon
```

## 🔄 场景切换

```bash
# 列出所有场景
./test/mock-api/use-scenario.sh list

# 切换场景
./test/mock-api/use-scenario.sh resetTimes-0    # resetTimes=0，应全部跳过
./test/mock-api/use-scenario.sh resetTimes-1    # resetTimes=1，第二次重置
./test/mock-api/use-scenario.sh resetTimes-2    # resetTimes=2，第一次重置
./test/mock-api/use-scenario.sh cooldown        # 冷却期内
./test/mock-api/use-scenario.sh mixed           # 混合场景
```

## 🛠️ 生成自定义场景

```bash
# 生成单个订阅
node test/mock-api/generate-scenario.mjs --resetTimes 0 --planName FREE

# 生成多个resetTimes的场景
node test/mock-api/generate-scenario.mjs --resetTimes 0,1,2 --planName FREE

# 生成冷却期场景
node test/mock-api/generate-scenario.mjs --cooldown --count 3

# 保存为场景文件
node test/mock-api/generate-scenario.mjs --resetTimes 0 --save my-test

# 查看帮助
node test/mock-api/generate-scenario.mjs --help
```

## 📊 查看结果

```bash
# 查看通知文件
ls -lh notifications/
cat notifications/notification-*.txt

# 查看日志
tail -f logs/app-*.log

# 查看API请求日志
grep "API请求" logs/app-*.log
```

## 🔧 手动测试

```bash
# 1. 启动Mock服务器
node test/mock-api/server.mjs &

# 2. 切换场景
./test/mock-api/use-scenario.sh resetTimes-0

# 3. 应用测试配置
cp test/.env.test .env

# 4. 运行测试
npm run reset:first
npm run reset:second

# 5. 查看结果
cat notifications/notification-*.txt
```

## 📝 常见测试流程

### 测试resetTimes=0被过滤

```bash
# 1. 切换到resetTimes=0场景
./test/mock-api/use-scenario.sh resetTimes-0

# 2. 运行测试
./test/run-test.sh both

# 3. 验证日志
# 应该看到"跳过"，不应该调用API
grep "跳过" logs/app-*.log
```

### 测试冷却期检查

```bash
# 1. 切换到冷却期场景
./test/mock-api/use-scenario.sh cooldown

# 2. 运行测试
./test/run-test.sh first

# 3. 验证日志
# 应该看到"冷却期内"
grep "冷却" logs/app-*.log
```

### 测试混合场景

```bash
# 1. 切换到混合场景
./test/mock-api/use-scenario.sh mixed

# 2. 运行测试
./test/run-test.sh both

# 3. 查看通知
cat notifications/notification-*.txt

# 4. 验证：
#    - resetTimes=0应该跳过
#    - resetTimes=1应该第二次重置
#    - resetTimes=2应该第一次重置
#    - PAYGO应该跳过（不参与重置）
```

## 🎨 自定义测试数据

直接编辑 `test/mock-api/test-data.json`，Mock服务器会自动重新加载：

```json
[
  {
    "resetTimes": 0,
    "id": 35306,
    "subscriptionPlanName": "FREE",
    "currentCredits": -2.89,
    "lastCreditReset": "2025-11-18 10:00:00",
    "isActive": true
  }
]
```

修改后无需重启Mock服务器，数据会自动生效！

## 💡 小技巧

1. **实时监控**
   ```bash
   # 终端1: Mock服务器
   node test/mock-api/server.mjs

   # 终端2: 应用日志
   tail -f logs/app-*.log

   # 终端3: 切换场景并测试
   ./test/mock-api/use-scenario.sh resetTimes-0
   ./test/run-test.sh both
   ```

2. **快速迭代**
   ```bash
   # 修改test-data.json后直接运行
   vi test/mock-api/test-data.json  # 编辑
   npm run reset:first               # 测试
   ```

3. **恢复备份**
   ```bash
   # 切换场景会自动备份
   cp test/mock-api/test-data.json.backup test/mock-api/test-data.json
   ```

## 📚 详细文档

- [测试框架总览](README.md)
- [Mock API说明](mock-api/README.md)
- [场景管理](mock-api/scenarios/README.md)
