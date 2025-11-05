# 88code 自动重置工具 - Node.js 版

> 智能额度最大化策略，确保每天用完所有重置次数

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## ✨ 核心特性

- ✅ **无脑重置策略**: 18:55和23:56自动重置，确保不浪费任何次数
- ✅ **智能延迟重置**: 23:56冷却中时自动延迟到冷却结束，严格限制23:59:50前完成
- ✅ **PAYGO四重保护**: 防止误重置按量付费订阅（4字段检查）
- ✅ **可配置冷却期**: 支持自定义冷却时间和缓冲时间
- ✅ **3次重试机制**: 指数退避，自动恢复
- ✅ **速率限制**: 令牌桶算法，防止触发API限流
- ✅ **完整日志**: 文件+控制台，支持日志轮转
- ✅ **多账号支持**: 批量管理多个API Key
- ✅ **Docker部署**: 一键部署，开箱即用

---

## 📦 快速开始

### 1. 安装依赖

```bash
# 克隆或下载项目
cd 88code-reset-nodejs

# 安装依赖（推荐使用 pnpm）
pnpm install

# 或使用 npm
npm install
```

### 2. 配置API Key

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件，填入你的API Key
# API_KEYS=88_your-api-key-here
```

### 3. 测试运行

```bash
# 测试API连接
pnpm run test
```

### 4. 正式运行

```bash
# 启动自动重置服务
pnpm start

# 或使用 Docker（推荐生产环境）
docker-compose up -d
```

---

## 🎯 重置策略说明

### 核心原则：确保每天用完所有2次重置机会

#### 18:55 首次重置

```
if (resetTimes == 2) {
    ✅ 无脑重置
    理由：如果不重置，23:55只能用1次，浪费1次机会
} else {
    ⏭️ 跳过
    理由：用户已手动重置，保留灵活性
}
```

#### 23:56 二次重置（支持智能延迟）

```
if (距离上次重置 >= 5小时) {
    ✅ 直接重置
} else if (冷却结束时间 <= 23:59:50) {
    ⏰ 创建延迟定时器
    ✅ 在冷却结束时自动重置
} else {
    ⏭️ 跳过（会跨天，避免浪费次日次数）
}
```

**为什么23:59:50而不是00:00？**
- 给10秒缓冲时间确保API调用完成
- 如果在00:00后执行，会消耗次日的resetTimes
- 严格限制在当天完成，保护次日的2次机会

### 为什么不看余额？

**数学证明：**

假设creditLimit = 100

| 场景 | 18:55余额 | 18:55操作 | 23:55操作 | 总可用额度 |
|------|-----------|-----------|-----------|------------|
| 旧策略 | 85% | 跳过 | 重置 | 185 credits |
| 新策略 | 85% | 重置 | 重置 | **200 credits** |

**结论：新策略总是 >= 旧策略**

---

## ⚙️ 配置说明

### 必填配置

```env
# API密钥（必填，多个用逗号分隔）
# 格式: 88_xxxxxx (40+字符)
API_KEYS=88_xxx,88_yyy
```

### 重置策略配置

```env
# 首次重置时间（24小时制）
FIRST_RESET_TIME=18:55

# 二次重置时间（24小时制，支持智能延迟重置）
SECOND_RESET_TIME=23:56

# 时区
TIMEZONE=Asia/Shanghai

# 冷却期（单位：小时，88code官方规定5小时）
COOLDOWN_HOURS=5

# 延迟重置缓冲时间（单位：秒）
# 确保延迟重置能在00:00前完成，避免跨天
END_OF_DAY_BUFFER=10
```

### 智能延迟重置说明

当23:56执行二次重置时，如果还在5小时冷却期内：

```
if (冷却结束时间 <= 23:59:50) {
    ✅ 创建延迟定时器，在冷却结束时自动重置
    💡 最大化利用每天的2次重置机会
} else {
    ⏭️ 跳过，避免跨天浪费次日的重置次数
}
```

**配置参数作用：**
- `COOLDOWN_HOURS`: 重置间隔时间（默认5小时，官方规定）
- `END_OF_DAY_BUFFER`: 缓冲时间（默认10秒），确保API调用在00:00前完成

### 高级配置

完整配置选项请查看 `.env.example`

---

## 📝 使用场景

### 场景1: 正常自动重置

```
每天18:55和23:55自动执行
无需任何手动操作
确保每天用完2次重置
```

### 场景2: 用户手动重置后

```
假设17:00用户手动重置（resetTimes: 2→1）

18:55检查:
  - resetTimes=1 (< 2)
  - 跳过，保留给用户

23:56检查:
  - resetTimes=1 (>= 1)
  - 执行重置

结果：总共2次重置（1次手动 + 1次自动）✅
```

### 场景3: 18:59手动重置（延迟重置场景）

```
18:59 用户手动重置
  → lastCreditReset = 18:59
  → resetTimes: 2→1

23:56 检查:
  → 距离上次：4小时57分 < 5小时 ❌
  → 冷却结束时间：18:59 + 5小时 = 23:59:00
  → 23:59:00 <= 23:59:50 ✅
  → 创建延迟定时器

23:59:00 自动触发:
  → 执行延迟重置
  → resetTimes: 1→0

结果：✅ 成功在今天完成2次重置！
```

### 场景4: 高余额情况

```
18:55时余额90%

旧策略: 跳过（余额高），可能浪费1次机会
新策略: 重置（无视余额），确保不浪费

次日额度: 新策略多10% ✅
```

### 场景5: 19:30手动重置（无法完成第二次）

```
19:30 用户手动重置
  → lastCreditReset = 19:30
  → resetTimes: 2→1

23:56 检查:
  → 距离上次：4小时26分 < 5小时 ❌
  → 冷却结束时间：19:30 + 5小时 = 00:30（次日）
  → 00:30 > 23:59:50 ❌
  → 放弃重置

日志输出：
[WARN] 冷却中，今天无法完成第二次重置
       (冷却结束时间: 2025-11-07 00:30:00, 还需等待: 30分钟)

结果：✅ 正常放弃（避免跨天浪费次日次数）
```

---

## 🚀 部署方案

### 方式1: 直接运行

```bash
pnpm start
```

### 方式2: PM2守护进程

```bash
# 安装PM2
pnpm install -g pm2

# 启动
pnpm run pm2:start

# 查看状态
pm2 status

# 查看日志
pnpm run pm2:logs

# 重启
pnpm run pm2:restart

# 停止
pnpm run pm2:stop
```

### 方式3: Docker部署 ⭐ 推荐

#### 快速开始

```bash
# 1. 确保已配置 .env 文件
cp .env.example .env
vim .env  # 填入你的 API_KEYS

# 2. 使用 docker-compose 启动（推荐）
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 停止容器
docker-compose down
```

#### 手动构建

```bash
# 构建镜像
docker build -t 88code-reset:latest .

# 运行容器
docker run -d \
  --name 88code-reset \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  88code-reset:latest

# 查看日志
docker logs -f 88code-reset

# 停止容器
docker stop 88code-reset
docker rm 88code-reset
```

#### Docker 常用命令

```bash
# 查看容器状态
docker ps -a | grep 88code-reset

# 进入容器
docker exec -it 88code-reset sh

# 查看实时日志
docker logs -f --tail 100 88code-reset

# 重启容器
docker restart 88code-reset

# 查看资源使用
docker stats 88code-reset

# 更新镜像
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### 镜像信息

- **基础镜像**: `node:18.20-alpine`
- **包管理器**: `pnpm 7.30.1`
- **镜像大小**: ~100MB（多阶段构建优化）
- **时区**: `Asia/Shanghai`

#### 持久化数据

容器会自动挂载以下目录到宿主机：
```
./logs  → /app/logs   # 日志文件
./data  → /app/data   # 历史数据
```

#### 健康检查

Docker 会自动监控容器健康状态：
```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' 88code-reset
```

状态说明：
- `healthy`: 运行正常 ✅
- `unhealthy`: 运行异常 ❌
- `starting`: 启动中 ⏳

---

## 📊 日志说明

### 日志位置

```
logs/
├── combined.log       # 所有日志
├── error.log          # 错误日志
└── reset-2025-11-06.log  # 按日期分割
```

### 日志示例

```
[2025-11-06 18:55:00] [INFO] ========== 开始执行首次重置 ==========
[2025-11-06 18:55:01] [INFO] 获取到 3 个订阅
[2025-11-06 18:55:02] [INFO] 符合条件的订阅: 2 个
[2025-11-06 18:55:03] [INFO] [订阅123] 执行首次重置 (重置次数满 2/2，当前余额 68.5%)
[2025-11-06 18:55:06] [SUCCESS] ✅ [订阅123] 重置成功: 68.50 → 100.00 credits
[2025-11-06 18:55:07] [INFO] ========== 重置完成 ==========
[2025-11-06 18:55:07] [INFO] 成功: 2, 失败: 0, 跳过: 0
```

---

## 🛡️ 安全特性

### PAYGO保护

```javascript
// 双重检查，防止误重置按量付费订阅
1. 获取订阅时过滤PAYGO
2. 重置前再次验证
```

### 速率限制

```javascript
// 令牌桶算法，10个令牌/分钟
防止触发API限流
自动等待令牌可用
```

### 冷却保护与延迟重置

```javascript
// 5小时冷却期检查（可配置）
精确计算剩余时间
智能延迟重置（23:56）
严格限制23:59:50前完成
```

---

## ❓ 常见问题

### Q: 为什么18:55时余额充足还要重置？

A: 确保不浪费重置次数。如果不重置，23:55只能用1次，长期累积会浪费大量机会。

**数学证明：30天累计**
```
旧策略（看余额）: 可能只用40次重置
新策略（不看余额）: 确保用60次重置
多获得: 20次 × 100 credits = 2000 credits
```

### Q: 如果我自己手动重置了怎么办？

A: 系统会自动识别。如果18:55时检测到resetTimes<2，说明你已手动重置过，会跳过18:55的自动重置，23:55仍会执行。

### Q: 支持多个账号吗？

A: 支持。在.env中用逗号分隔多个API Key：
```env
API_KEYS=88_xxx,88_yyy,88_zzz
```

### Q: 如何修改重置时间？

A: 编辑.env文件：
```env
FIRST_RESET_TIME=19:00   # 改为19:00
SECOND_RESET_TIME=23:56  # 建议保持23:56
```
注意：
- 两次重置至少间隔5小时（可通过COOLDOWN_HOURS配置）
- SECOND_RESET_TIME建议设为23:56，支持智能延迟重置

### Q: 什么是延迟重置？为什么需要？

A: 延迟重置是为了最大化利用每天2次重置机会。

**场景说明：**
```
如果你在18:59手动重置，到23:56时冷却期还没过（差3分钟）
- 没有延迟重置：23:56跳过，浪费1次机会 ❌
- 有延迟重置：23:59自动执行，用满2次机会 ✅
```

**配置说明：**
```env
COOLDOWN_HOURS=5         # 冷却期（小时）
END_OF_DAY_BUFFER=10     # 缓冲时间（秒）
```

### Q: 为什么延迟重置要限制在23:59:50前？

A: 避免跨天浪费次日的重置次数。

**问题场景（如果允许跨天）：**
```
19:30 手动重置（resetTimes: 2→1）
00:00 系统刷新（resetTimes: 1→2）
00:30 跨天重置执行（resetTimes: 2→1）← 这用的是次日的次数！
```

**正确做法：**
```
严格限制23:59:50前：
- 能完成就延迟执行 ✅
- 完成不了就放弃 ✅（不算浪费，避免占用次日）
```

### Q: 日志文件太大怎么办？

A: 配置日志轮转：
```env
LOG_MAX_SIZE=10    # 单文件最大10MB
LOG_MAX_DAYS=30    # 保留30天
```

---

## 📈 监控

### 健康检查（可选）

启用HTTP健康检查服务器：

```env
ENABLE_HEALTH_CHECK=true
HEALTH_CHECK_PORT=3000
```

访问：`http://localhost:3000/health`

返回：
```json
{
  "status": "healthy",
  "uptime": 86400,
  "lastReset": "2025-11-06T15:55:00Z",
  "nextReset": "2025-11-06T18:55:00Z"
}
```

---

## 🔧 开发

### 项目结构

```
src/
├── core/               # 核心业务逻辑
│   ├── APIClient.js    # API客户端
│   ├── ResetService.js # 重置服务
│   └── Scheduler.js    # 调度器
├── utils/              # 工具类
│   ├── Logger.js       # 日志系统
│   ├── RateLimiter.js  # 速率限制
│   ├── RetryHelper.js  # 重试工具
│   └── TimeUtils.js    # 时间工具
├── storage/            # 存储层
│   └── FileStorage.js  # 文件存储
├── constants.js        # 常量定义
├── config.js           # 配置管理
└── index.js            # 入口文件
```

### 开发模式

```bash
# 启动开发模式（自动重启）
npm run dev
```

---

## 📄 License

MIT License

---

## 🙏 致谢

- 灵感来自 [88code_reset](https://github.com/Vulpecula-Studio/88code_reset) (Go版本)
- 策略优化基于社区反馈

---

## 📧 联系

- Issue: [GitHub Issues](https://github.com/yourusername/88code-reset-nodejs/issues)
- Email: your.email@example.com

---

**Happy Coding! 🚀**
