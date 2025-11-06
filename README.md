# 88code 自动重置工具 - Node.js 版

> 基于 88code PLUS 月卡的智能额度重置工具，每日两次重置，最大化利用额度

## 📑 目录

- [⚠️ 免责声明](#️-免责声明)
- [🚀 一键部署](#-一键部署)
- [✨ 核心特性](#-核心特性)
- [💡 额度说明](#-额度说明)
- [📦 快速开始](#-快速开始)
- [🎯 重置策略详解](#-重置策略详解)
- [⚙️ 配置说明](#️-配置说明)
- [📝 使用场景示例](#-使用场景示例)
- [🚀 部署方案](#-部署方案)
- [📊 日志说明](#-日志说明)
- [🛡️ 安全特性](#️-安全特性)
- [❓ 常见问题](#-常见问题)
- [📈 监控](#-监控)
- [🔧 开发](#-开发)

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Hub-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/huby11111/88code-reset-nodejs)

## ⚠️ 免责声明

**重要提示**：

1. **依赖官方 API**：本工具依赖 88code 官方 API 接口（`https://api.88code.com`），所有重置操作均通过官方接口执行
2. **源码审查**：重置接口的可靠性和安全性需要您自行审查源码验证，源码完全开放：[src/core/APIClient.js](./src/core/APIClient.js)
3. **使用风险**：本人不对使用本工具导致的任何结果负责，包括但不限于：
   - 额度重置失败
   - 账号异常
   - 数据丢失
   - 其他不可预见的问题
4. **自担责任**：使用本工具即表示您已阅读、理解并同意自行承担所有使用风险

**建议**：
- ✅ 使用前仔细阅读源码，特别是 API 调用部分
- ✅ 先使用测试模式验证（`pnpm run test`）
- ✅ 建议从小额度账号开始测试
- ✅ 定期检查日志，确保运行正常

## 🚀 一键部署

> **提示**：使用一键部署前，请先 [Fork 本仓库](https://github.com/2ue/88code-reset-nodejs/fork) 到您的 GitHub 账号

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
[![Deploy to Fly.io](https://img.shields.io/badge/Deploy%20to-Fly.io-blueviolet?logo=fly.io)](https://fly.io/docs/hands-on/install-flyctl/)

**部署步骤**：
1. 点击上方按钮，选择您 Fork 的仓库
2. 配置环境变量（特别是 `API_KEYS`）
3. 等待自动部署完成

### 🌐 云平台部署对比

| 平台 | 免费额度 | 持久化存储 | 难度 | 推荐度 | 特色功能 |
|------|---------|-----------|------|--------|---------|
| **[Railway](https://railway.app)** | $5/月 (500h) | ✅ 免费 | ⭐ | ⭐⭐⭐⭐⭐ | 一键部署、零配置 |
| **[Render](https://render.com)** | 750h/月 | 💰 付费 | ⭐⭐ | ⭐⭐⭐⭐ | Blueprint自动化 |
| **[Fly.io](https://fly.io)** | 3 VM + 160GB | ✅ 免费 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 全球部署、高可用 |

#### 📖 详细部署文档

- **[完整部署指南](./deploy/README.md)** - 所有平台详细部署文档
- **[Railway 部署](./deploy/railway.md)** - 最简单的云部署方式 ⭐推荐
- **[Render 部署](./deploy/render.md)** - GitHub 集成，自动部署
- **[Fly.io 部署](./deploy/fly.md)** - 全球分布式部署
- **[Docker 部署](./deploy/docker.md)** - 本地容器化部署
- **[本地部署](./deploy/local.md)** - Docker Compose、源码运行

---

## ✨ 核心特性

- ✅ **PLUS月卡优化**: 专为88code PLUS月卡设计，每日两次50刀额度重置
- ✅ **智能额度最大化**: 18:55和23:56双重重置，充分利用每日两次重置机会
- ✅ **智能延迟重置**: 23:56冷却中时自动延迟到冷却结束，严格限制23:59:50前完成
- ✅ **PAYGO四重保护**: 防止误重置按量付费订阅（4字段检查）
- ✅ **可配置冷却期**: 支持自定义冷却时间和缓冲时间（官方规定5小时间隔）
- ✅ **3次重试机制**: 指数退避，自动恢复
- ✅ **速率限制**: 令牌桶算法，防止触发API限流
- ✅ **完整日志**: 文件+控制台，支持日志轮转
- ✅ **多账号支持**: 批量管理多个API Key
- ✅ **Docker部署**: 一键部署，开箱即用

---

## 💡 额度说明

### 88code PLUS 月卡官方规则

根据 88code 官方文档，PLUS 月卡用户享有以下权益：

> **重要提示**：以下额度信息基于当前官方政策，具体额度请以 [88code 官方文档](https://docs.88code.com) 为准，如有变动请以官方最新说明为准。

| 套餐类型 | 价格 | 每日额度 | 额度上限 | 重置机制 |
|---------|------|---------|---------|----------|
| **PLUS 月卡** | 198元/月 | 100 刀 | **50 刀** | **每天两次重置至上限** |

### 核心规则

1. **额度上限**: PLUS 月卡用户的额度上限为 **50 美元**
2. **重置机制**: 每天有 **两次** 可以把额度重置到上限的机会
3. **时间间隔**: 两次重置之间至少间隔 **5 小时**
4. **自由选择**: 重置时间可以自由选择，但需满足间隔要求

### 智能重置策略

> **每次重置 = 恢复 50 刀额度到上限，与当前已使用额度无关**

| 重置次数 | 当日可用总额度 | 说明 |
|---------|---------------|------|
| 0次 | 50 刀 | 仅使用初始额度 |
| 1次 | 100 刀 | 初始 + 重置1次 |
| 2次 | **150 刀** ✅ | 初始 + 重置2次（**最优**）|

**为什么选择18:55和23:56？**
- 确保在5小时冷却期限制下，尽可能使用2次重置机会
- 最大化利用每日两次重置权利，达到150 刀总可用额度
- 23:56的智能延迟重置确保不浪费任何重置机会

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
wget https://raw.githubusercontent.com/2ue/88code-reset-nodejs/main/docker-compose.yml

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
git clone https://github.com/2ue/88code-reset-nodejs.git
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

### 核心原则

**目标**: 每天用满2次重置机会,达到150刀理论上限 (50刀初始 + 2次重置×50刀)

### 重置时间

| 时间 | 目的 | 逻辑 |
|------|------|------|
| **18:55** | 首次重置 | 若 resetTimes=2 → 立即重置<br>若 resetTimes<2 → 跳过(已手动重置) |
| **23:56** | 二次重置 | 若已过冷却期 → 立即重置<br>若冷却中且能在23:59:50前完成 → 延迟重置<br>否则 → 跳过(保护次日额度) |

### 核心逻辑

**为什么不看余额?**
- 重置 = 恢复到50刀上限,与当前剩余无关
- 即使余额还有45刀(90%),重置后仍获得完整50刀额度
- 月度收益: 30天×150刀 vs 跳过6天后的4200刀 = **多300刀/月**

**为什么23:59:50截止?**
- 给10秒缓冲确保API完成
- 避免跨天消耗次日重置次数
- 宁可今天100刀,也不占用次日机会

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
    💡 确保锁定第二个50 刀新额度，达到每日150 刀理论上限
} else {
    ⏭️ 跳过，保护次日的150 刀理论上限（避免跨天消耗次日重置机会）
}
```

**配置参数作用：**
- `COOLDOWN_HOURS`: 重置间隔时间（默认5小时，官方规定）
- `END_OF_DAY_BUFFER`: 缓冲时间（默认10秒），确保API调用在00:00前完成，保护次日额度

### 高级配置

完整配置选项请查看 `.env.example`

---

## 📝 使用场景示例

| 场景 | 用户操作 | 系统行为 | 当日总额度 | 说明 |
|------|---------|---------|-----------|------|
| **完全自动** | 无操作 | 18:55重置 + 23:56重置 | **150刀** ✅ | 最优方案,无需干预 |
| **提前手动** | 17:00手动重置 | 18:55跳过 + 23:56重置 | **150刀** ✅ | 兼容手动操作 |
| **临界手动** | 18:59手动重置 | 18:55跳过 + 23:59延迟重置 | **150刀** ✅ | 智能延迟避免浪费 |
| **高余额** | 余额90%不重置 | 当日仅1次重置 | **100刀** ❌ | 损失50刀/天 |
| **过晚手动** | 19:30手动重置 | 冷却期跨天,放弃23:56 | **100刀** ⚠️ | 保护次日额度 |

**关键提示**:
- ✅ 即使余额充足也要重置 - 重置是恢复到50刀上限,不是清空
- ⏰ 避免19:00后手动重置 - 可能导致第二次重置跨天
- 🎯 信任自动化 - 让工具在18:55和23:56自动执行

---

## 🚀 部署方案

### 本地部署

#### 1. Docker 镜像（推荐）

**直接拉取已发布镜像**：
```bash
# 从 Docker Hub 拉取
docker pull huby11111/88code-reset-nodejs:latest

# 或从 GitHub Container Registry 拉取
docker pull ghcr.io/2ue/88code-reset-nodejs:latest

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
wget https://raw.githubusercontent.com/2ue/88code-reset-nodejs/main/docker-compose.yml

# 2. 配置环境变量
cp .env.example .env
vim .env

# 3. 启动
docker-compose up -d
```

#### 3. 源码编译部署

```bash
# 1. 克隆项目
git clone https://github.com/2ue/88code-reset-nodejs.git
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
1. [Fork 本仓库](https://github.com/2ue/88code-reset-nodejs/fork)到您的 GitHub
2. 点击上方 [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)
3. 选择您 Fork 的仓库
4. 配置 `API_KEYS` 环境变量
5. 点击 Deploy ✅

> **📖 Railway 详细文档**: [deploy/railway.md](./deploy/railway.md) | **官方网站**: [railway.app](https://railway.app) | **官方文档**: [docs.railway.app](https://docs.railway.app)

#### Render（Blueprint 自动化）
1. [Fork 本仓库](https://github.com/2ue/88code-reset-nodejs/fork)到您的 GitHub
2. 点击上方 [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
3. 选择您 Fork 的仓库
4. 自动读取 `render.yaml` 配置
5. 配置 `API_KEYS` 密钥
6. 一键部署 ✅

> **📖 Render 详细文档**: [deploy/render.md](./deploy/render.md) | **官方网站**: [render.com](https://render.com) | **官方文档**: [render.com/docs](https://render.com/docs)

#### Fly.io（全球加速）
```bash
# 1. Fork 并克隆您的仓库
git clone https://github.com/YOUR_USERNAME/88code-reset-nodejs.git
cd 88code-reset-nodejs

# 2. 安装 CLI
curl -L https://fly.io/install.sh | sh

# 3. 登录
flyctl auth login

# 4. 部署
flyctl launch
flyctl secrets set API_KEYS=88_xxx,88_yyy
flyctl deploy
```

> **📖 Fly.io 详细文档**: [deploy/fly.md](./deploy/fly.md) | **官方网站**: [fly.io](https://fly.io) | **官方文档**: [fly.io/docs](https://fly.io/docs)

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

A: 因为重置不是"清空余额"，而是**获得新的50 刀额度配额**。

让我们算笔账（PLUS月卡额度上限50刀）：

**❌ 不重置的情况：**
```
00:00-18:55：使用5刀
18:55：余额90%，不重置（觉得"还够用"）
18:55-23:56：继续使用
23:56：重置1次，锁定+50 刀
理论总额度：50 + 50 = 100 刀
```

**✅ 重置的情况：**
```
00:00-18:55：使用5刀
18:55：余额90%，重置（锁定+50 刀新额度）
18:55-23:56：可以继续使用95刀
23:56：重置1次，锁定+50 刀
理论总额度：50 + 50 + 50 = 150 刀
```

**差异：多50 刀！**

**关键洞察**：当前余额的90%只是"还没用完"，不影响"重置能带来的新额度"。就像信用卡额度重置，不管你上个周期用了多少，重置后都是全额。

**30天累积效应**：
```
如果20%的天数因"余额高"而跳过重置
损失：6天 × 50 刀 = 300 刀/月
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

A: 延迟重置是为了**最大化理论可用额度**，确保尽可能达到每日150 刀上限。

**场景说明（PLUS月卡额度上限50刀）：**
```
18:59 手动重置：锁定+50 刀（理论额度 100 刀）
23:56 检查：冷却期还差3分钟
23:59 延迟触发：锁定+50 刀（理论额度 150 刀）✅

如果没有延迟重置：
23:56 直接跳过，理论额度只有 100 刀
损失：50 刀 ❌
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
19:30 手动重置（理论额度 100 刀）
00:00 系统刷新（resetTimes 恢复为2）

次日：
00:30 跨天重置执行 ← 消耗次日的重置机会！
      次日理论额度从 150 刀降为 100 刀 ❌
```

**正确做法：**
```
严格限制23:59:50前：
- 能在今天完成 → 延迟执行，今日达到150刀 ✅
- 无法在今天完成 → 放弃，保护次日的150刀上限 ✅
```

**结论**：宁可今天100刀，也不占用次日的额度机会。

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

- Issue: [GitHub Issues](https://github.com/2ue/88code-reset-nodejs/issues)
- Email: jie746635835@163.com

---

**Happy Coding! 🚀**
