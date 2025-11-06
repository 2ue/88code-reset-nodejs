# 88code 自动重置工具 - Node.js 版

> 智能额度最大化策略，每日理论上限 300 credits

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Hub-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/huby11111/88code-reset-nodejs)

## 🚀 一键部署

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
[![Deploy to Fly.io](https://img.shields.io/badge/Deploy%20to-Fly.io-blueviolet?logo=fly.io)](https://fly.io/docs/hands-on/install-flyctl/)

---

## ✨ 核心特性

- ✅ **智能额度最大化**: 18:55和23:56双重重置，确保每日300 credits理论上限
- ✅ **智能延迟重置**: 23:56冷却中时自动延迟到冷却结束，严格限制23:59:50前完成
- ✅ **PAYGO四重保护**: 防止误重置按量付费订阅（4字段检查）
- ✅ **可配置冷却期**: 支持自定义冷却时间和缓冲时间
- ✅ **3次重试机制**: 指数退避，自动恢复
- ✅ **速率限制**: 令牌桶算法，防止触发API限流
- ✅ **完整日志**: 文件+控制台，支持日志轮转
- ✅ **多账号支持**: 批量管理多个API Key
- ✅ **Docker部署**: 一键部署，开箱即用

---

## 💡 一句话原理

> **每次重置 = 锁定 100 credits 新额度，与当前余额无关**

| 重置次数 | 理论总额度 | 说明 |
|---------|-----------|------|
| 0次 | 100 credits | 只有初始额度 |
| 1次 | 200 credits | 初始 + 重置1次 |
| 2次 | **300 credits** ✅ | 初始 + 重置2次（**最优**）|

**为什么18:55和23:56？** 确保在5小时冷却期限制下，尽可能使用2次重置，达到300 credits理论上限。

---

## 📦 快速开始

### 方式1: 使用 Docker 镜像（最简单）

```bash
# 1. 拉取镜像
docker pull huby11111/88code-reset-nodejs:latest

# 2. 创建 .env 文件
cat > .env << EOF
API_KEYS=88_your_key_here,88_another_key_here
API_BASE_URL=https://api.88code.com
NODE_ENV=production
TZ=Asia/Shanghai
EOF

# 3. 运行容器
docker run -d \
  --name 88code-reset \
  --env-file .env \
  --restart unless-stopped \
  -v $(pwd)/logs:/app/logs \
  huby11111/88code-reset-nodejs:latest

# 4. 查看日志
docker logs -f 88code-reset
```

### 方式2: 使用 Docker Compose

```bash
# 1. 下载配置文件
wget https://raw.githubusercontent.com/yourusername/88code-reset-nodejs/main/docker-compose.yml

# 2. 配置环境变量
cp .env.example .env
vim .env  # 填入你的 API_KEYS

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

### 方式3: 源码运行

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/88code-reset-nodejs.git
cd 88code-reset-nodejs

# 2. 安装依赖（推荐使用 pnpm）
pnpm install
# 或使用 npm
npm install

# 3. 配置 API Key
cp .env.example .env
vim .env  # 填入你的 API_KEYS

# 4. 测试运行
pnpm run test

# 5. 启动服务
pnpm start

# 6. (可选) 使用 PM2 守护进程
pnpm install -g pm2
pnpm run pm2:start
pm2 status
```

---

## 🎯 重置策略详解

### 核心原则：最大化每日理论可用额度

#### 理论额度公式

```
每日理论最大可用额度 = 初始额度 + ∑(重置获得的额度)

假设 creditLimit = 100：
- 使用0次重置：100 credits
- 使用1次重置：200 credits
- 使用2次重置：300 credits ✅ 最优
```

#### 18:55 首次重置

**目的**：锁定第一个100 credits新额度

```
if (resetTimes == 2) {
    ✅ 立即重置 → 确保理论总额度至少达到 200 credits
    说明：今天还未手动重置，需要主动锁定新额度
} else {
    ⏭️ 跳过
    说明：用户已手动重置，已锁定100 credits新额度
}
```

#### 23:56 二次重置（支持智能延迟）

**目的**：锁定第二个100 credits新额度，达到300 credits理论上限

```
if (距离上次重置 >= 5小时) {
    ✅ 直接重置 → 理论总额度达到 300 credits
} else if (冷却结束时间 <= 23:59:50) {
    ⏰ 创建延迟定时器，在冷却结束时自动重置
    ✅ 最大化利用每日2次重置机会
} else {
    ⏭️ 跳过（会跨天，避免消耗次日的重置机会）
}
```

**为什么23:59:50而不是00:00？**
- 给10秒缓冲时间确保API调用完成
- 如果在00:00后执行，会消耗次日的重置次数
- 严格限制在当天完成，保护次日的300 credits理论上限

### 为什么不看余额？用理论额度说话

**核心概念：重置 ≠ 清空余额，重置 = 获得新的100 credits额度配额**

#### 直观对比（creditLimit=100）

🔴 **错误理解："余额还很多，重置很浪费"**
```
18:55 余额85%
决定：不重置（觉得"还够用"）
结果：当日只重置1次
理论总额度：200 credits
```

✅ **正确理解："重置=锁定新的100额度"**
```
18:55 余额85%
决定：立即重置
收益：不是"浪费了85"，而是"额外锁定了100"
理论总额度：300 credits
差异：+100 credits ✅
```

#### 多场景对比表

| 使用模式 | 18:55余额 | 是否重置 | 理论总额度 | 说明 |
|---------|-----------|---------|-----------|------|
| 轻度使用 | 90% | ❌ 不重置 | 200 credits | 损失100 credits |
| 轻度使用 | 90% | ✅ 重置 | 300 credits | 锁定满额 |
| 中度使用 | 50% | ❌ 不重置 | 200 credits | 损失100 credits |
| 中度使用 | 50% | ✅ 重置 | 300 credits | 锁定满额 |
| 重度使用 | 10% | ✅ 重置 | 300 credits | 锁定满额 |

**关键发现**：无论当前余额多少，重置都能带来固定的100 credits新增额度

#### 长期收益计算（30天）

假设有20%的天数因"余额高"而跳过18:55重置：

- **旧策略（看余额）**：24天×300 + 6天×200 = 8400 credits
- **新策略（不看余额）**：30天×300 = 9000 credits
- **月度差异**：+600 credits/月 ✅

**结论**：重置带来的新增额度是固定的（100 credits），与当前余额高低无关。就像信用卡额度重置，不管上个周期用了多少，重置后都是全额。

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
    💡 确保锁定第二个100 credits新额度，达到每日300 credits理论上限
} else {
    ⏭️ 跳过，保护次日的300 credits理论上限（避免跨天消耗次日重置机会）
}
```

**配置参数作用：**
- `COOLDOWN_HOURS`: 重置间隔时间（默认5小时，官方规定）
- `END_OF_DAY_BUFFER`: 缓冲时间（默认10秒），确保API调用在00:00前完成，保护次日额度

### 高级配置

完整配置选项请查看 `.env.example`

---

## 📝 使用场景示例

### 场景1: 正常自动重置

**时间线与理论额度**：
```
00:00 - 初始额度：100 credits
18:55 - 自动重置：锁定+100 credits（累计理论额度 200）
23:56 - 自动重置：锁定+100 credits（累计理论额度 300）

结果：✅ 达到每日理论上限 300 credits
无需任何手动操作
```

### 场景2: 用户17:00手动重置

**时间线与理论额度**：
```
00:00 - 初始额度：100 credits
17:00 - 用户手动重置：锁定+100 credits（累计理论额度 200）
        resetTimes: 2→1

18:55 - 检查发现 resetTimes=1 < 2
        说明：用户已手动重置，跳过（保留用户灵活性）

23:56 - 自动重置：锁定+100 credits（累计理论额度 300）

结果：✅ 手动+自动配合，仍达到理论上限 300 credits
```

### 场景3: 18:59手动重置（延迟重置场景）

**时间线与理论额度**：
```
00:00 - 初始额度：100 credits
18:59 - 用户手动重置：锁定+100 credits（累计理论额度 200）
        lastCreditReset = 18:59

23:56 - 检查：距离上次 4小时57分 < 5小时 ❌
        冷却结束时间：23:59:00 <= 23:59:50 ✅
        创建延迟定时器

23:59:00 - 延迟重置触发：锁定+100 credits（累计理论额度 300）

结果：✅ 成功在今天达到理论上限 300 credits
智能延迟确保不浪费任何额度机会
```

### 场景4: 轻度使用（高余额）

**对比分析**：
```
18:55 - 当前余额90%（只使用了10 credits）

❌ 旧思维：余额还很多，不需要重置
   结果：理论总额度 = 200 credits
   损失：100 credits

✅ 新思维：重置=锁定新的100 credits额度
   结果：理论总额度 = 300 credits
   收益：+100 credits

关键：余额90%只代表"已使用10%"，
     与"重置能带来的新增额度"无关
```

### 场景5: 19:30手动重置（无法完成第二次）

**时间线与理论额度**：
```
00:00 - 初始额度：100 credits
19:30 - 用户手动重置：锁定+100 credits（累计理论额度 200）
        lastCreditReset = 19:30

23:56 - 检查：距离上次 4小时26分 < 5小时 ❌
        冷却结束时间：00:30（次日） > 23:59:50 ❌
        放弃重置

理论总额度：200 credits（比最优少100 credits）

日志输出：
[WARN] 冷却中，今天无法完成第二次重置
       (冷却结束时间: 2025-11-07 00:30:00, 还需等待: 30分钟)

结果：✅ 正确放弃（避免跨天消耗次日的重置机会）
说明：虽然未达到300 credits，但保护了次日的理论额度
```

---

## 🚀 部署方案

### 本地部署

#### 1. Docker 镜像（推荐）

**直接拉取已发布镜像**：
```bash
# 从 Docker Hub 拉取
docker pull huby11111/88code-reset-nodejs:latest

# 或从 GitHub Container Registry 拉取
docker pull ghcr.io/yourusername/88code-reset-nodejs:latest

# 运行容器
docker run -d \
  --name 88code-reset \
  --env-file .env \
  --restart unless-stopped \
  -v $(pwd)/logs:/app/logs \
  huby11111/88code-reset-nodejs:latest
```

#### 2. Docker Compose

```bash
# 1. 下载 docker-compose.yml
wget https://raw.githubusercontent.com/yourusername/88code-reset-nodejs/main/docker-compose.yml

# 2. 配置环境变量
cp .env.example .env
vim .env

# 3. 启动
docker-compose up -d
```

#### 3. 源码编译部署

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/88code-reset-nodejs.git
cd 88code-reset-nodejs

# 2. 安装依赖
pnpm install

# 3. 配置环境
cp .env.example .env
vim .env

# 4. 启动服务
# 方式A: 直接运行
pnpm start

# 方式B: PM2 守护进程（推荐生产环境）
pnpm install -g pm2
pnpm run pm2:start
pm2 save
pm2 startup
```

### 云平台部署

| 平台 | 免费额度 | 难度 | 推荐度 | 适合场景 |
|------|---------|------|--------|---------|
| [**Railway**](./deploy/railway.md) | $5/月 (500h) | ⭐ | ⭐⭐⭐⭐⭐ | 一键部署、零配置 |
| [**Render**](./deploy/render.md) | 750h/月 | ⭐⭐ | ⭐⭐⭐⭐ | Blueprint自动化 |
| [**Fly.io**](./deploy/fly.md) | 3 VM + 160GB | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 全球部署、高可用 |

#### Railway（最简单）
1. 点击上方 [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)
2. 连接 GitHub 仓库
3. 配置 `API_KEYS` 环境变量
4. 点击 Deploy ✅

#### Render（Blueprint 自动化）
1. 点击上方 [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
2. 自动读取 `render.yaml` 配置
3. 配置 `API_KEYS` 密钥
4. 一键部署 ✅

#### Fly.io（全球加速）
```bash
# 1. 安装 CLI
curl -L https://fly.io/install.sh | sh

# 2. 登录
flyctl auth login

# 3. 部署
flyctl launch
flyctl secrets set API_KEYS=88_xxx,88_yyy
flyctl deploy
```

> 📖 **详细文档**: [部署方案总览](./deploy/README.md)

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

### Q: 为什么18:55时余额还有90%，也要重置？

A: 因为重置不是"清空余额"，而是**获得新的100 credits额度配额**。

让我们算笔账（creditLimit=100）：

**❌ 不重置的情况：**
```
00:00-18:55：使用10 credits
18:55：余额90%，不重置（觉得"还够用"）
18:55-23:56：继续使用
23:56：重置1次，锁定+100 credits
理论总额度：100 + 100 = 200 credits
```

**✅ 重置的情况：**
```
00:00-18:55：使用10 credits
18:55：余额90%，重置（锁定+100 credits新额度）
18:55-23:56：可以继续使用190 credits
23:56：重置1次，锁定+100 credits
理论总额度：100 + 100 + 100 = 300 credits
```

**差异：多100 credits！**

**关键洞察**：当前余额的90%只是"还没用完"，不影响"重置能带来的新额度"。就像信用卡额度重置，不管你上个周期用了多少，重置后都是全额。

**30天累积效应**：
```
如果20%的天数因"余额高"而跳过重置
损失：6天 × 100 credits = 600 credits/月
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

A: 延迟重置是为了**最大化理论可用额度**，确保尽可能达到每日300 credits上限。

**场景说明（creditLimit=100）：**
```
18:59 手动重置：锁定+100 credits（理论额度 200）
23:56 检查：冷却期还差3分钟
23:59 延迟触发：锁定+100 credits（理论额度 300）✅

如果没有延迟重置：
23:56 直接跳过，理论额度只有 200 credits
损失：100 credits ❌
```

**配置说明：**
```env
COOLDOWN_HOURS=5         # 冷却期（小时）
END_OF_DAY_BUFFER=10     # 缓冲时间（秒）
```

### Q: 为什么延迟重置要限制在23:59:50前？

A: 保护次日的理论额度，避免跨天消耗次日的重置机会。

**问题场景（如果允许跨天）：**
```
当日：
19:30 手动重置（理论额度 200）
00:00 系统刷新（resetTimes 恢复为2）

次日：
00:30 跨天重置执行 ← 消耗次日的重置机会！
      次日理论额度从 300 降为 200 ❌
```

**正确做法：**
```
严格限制23:59:50前：
- 能在今天完成 → 延迟执行，今日达到300 ✅
- 无法在今天完成 → 放弃，保护次日的300上限 ✅
```

**结论**：宁可今天200，也不占用次日的额度机会。

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
