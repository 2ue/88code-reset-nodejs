# 88code 自动重置工具 - Node.js 版

> 88code 智能额度重置工具，支持月付订阅自动重置，每日两次重置，最大化利用额度

## 📑 目录

- [⚠️ 免责声明](#️-免责声明)
- [✨ 核心特性](#-核心特性)
- [💡 额度说明](#-额度说明)
- [🚀 部署方式](#-部署方式)
- [运行源码](#-运行源码)
- [🎯 重置策略详解](#-重置策略详解)
- [⚙️ 配置说明](#️-配置说明)
- [📝 使用场景示例](#-使用场景示例)
- [❓ 常见问题](#-常见问题)
- [📈 监控](#-监控)
- [🔧 开发](#-开发)

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Hub-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/huby11111/88code-reset-nodejs)

## ⚠️ 免责声明

**重要提示**：

1. **依赖官方 API**：本工具依赖 88code 官方 API 接口（`https://www.88code.org`），所有重置操作均通过官方接口执行
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

---

## ✨ 核心特性

- ✅ **月付订阅支持**: 支持所有月付订阅套餐，每日两次额度重置最大化利用
- ✅ **智能订阅过滤**: 仅重置月付订阅（billingCycle=monthly），自动跳过年付订阅
- ✅ **智能额度最大化**: 18:55和23:56双重重置，充分利用每日两次重置机会
- ✅ **智能延迟重置**: 23:56冷却中时自动延迟到冷却结束后执行（支持跨天）
- ✅ **可配置冷却期**: 支持自定义冷却时间和缓冲时间（官方规定5小时间隔）
- ✅ **3次重试机制**: 指数退避，自动恢复
- ✅ **速率限制**: 令牌桶算法，防止触发API限流
- ✅ **多账号支持**: 批量管理多个API Key
- ✅ **通知支持**: Telegram Bot、企业微信机器人通知
- ✅ **Docker部署**: 一键部署，开箱即用

---

## 💡 额度说明

### 88code PLUS 月卡官方规则

根据 88code 官方文档，PLUS 月卡用户享有以下权益：

> **重要提示**：以下额度信息基于当前官方政策，具体额度请以 [88code 官方文档](https://docs.88code.com) 为准，如有变动请以官方最新说明为准。

| 套餐类型 | 价格 | 额度上限 | 重置机制 | 每日可用总额度 |
|---------|------|---------|---------|---------------|
| **PLUS 月卡** | 198元/月 | **50 刀** | **每天两次重置至上限** | **150 刀** |

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

## 🎯 重置策略详解

### 核心原则

**目标**: 每天用满2次重置机会,达到150刀理论上限 (50刀初始 + 2次重置×50刀)

### 重置时间

| 时间 | 目的 | 逻辑 |
|------|------|------|
| **18:55** | 首次重置 | 若 resetTimes=2 → 立即重置<br>若 resetTimes<2 → 跳过(已手动重置) |
| **23:56** | 二次重置 | 若 resetTimes<1 → 跳过(次数用完)<br>若已过冷却期 → 立即重置<br>若冷却中 → 延迟重置(支持跨天) |

### 核心逻辑

**为什么不看余额?**
- 重置 = 恢复到50刀上限,与当前剩余无关
- 即使余额还有45刀(90%),重置后仍获得完整50刀额度
- 月度收益: 30天×150刀 vs 跳过6天后的4200刀 = **多300刀/月**

**为什么支持跨天延迟重置?**
- 最大化利用每日重置机会，不浪费任何次数
- 精确计算冷却结束时间，自动调度执行
- 次日0点系统会自动刷新resetTimes，不影响次日额度

---

## ⚙️ 配置说明

### 必填配置

**推荐方式：复制模板文件**

```bash
cp .env.example .env
vim .env  # 修改 API_KEYS（多个用逗号分隔）
```

**核心配置项：**

```env
# API密钥（必填，多个用逗号分隔）
# 格式: 88_xxxxxx (40+字符)
API_KEYS=88_your_api_key_here_replace_with_real_key
```

### 重置策略配置

```env
# 首次重置时间（24小时制）
FIRST_RESET_TIME=18:55

# 二次重置时间（24小时制，支持智能延迟重置）
SECOND_RESET_TIME=23:56

# 不参与自动重置的订阅名称（逗号分隔，匹配 subscriptionPlan.subscriptionName，大小写不敏感）
EXCLUDE_PLAN_NAMES=

# 冷却期（单位：小时，88code官方规定5小时）
COOLDOWN_HOURS=5
```

### 智能延迟重置说明

当23:56执行二次重置时，如果还在5小时冷却期内：

```
if (resetTimes < 1) {
    ⏭️ 跳过，次数已用完
} else if (冷却已过) {
    ✅ 立即重置
} else {
    ⏲️ 创建延迟定时器，在冷却结束时自动重置（支持跨天）
    💡 确保锁定第二个重置机会，达到理论上限
}
```

**配置参数作用：**
- `COOLDOWN_HOURS`: 重置间隔时间（默认5小时，官方规定）

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

## 🚀 部署方式

### 一键部署（⭐ 最简单）

```bash
curl -fsSL https://raw.githubusercontent.com/2ue/88code-reset-nodejs/main/install.sh | bash
```

**脚本会自动**：
1. 检测 Docker / Docker Compose 环境
2. 下载配置文件（自动选择最快镜像源）
3. 引导输入 API Keys（支持多个，逗号分隔）
4. 启动服务
5. 可选查看日志

---

### Docker 部署

```bash
# 1. 拉取镜像
docker pull huby11111/88code-reset-nodejs:latest

# 2. 下载配置文件模板
wget https://raw.githubusercontent.com/2ue/88code-reset-nodejs/main/.env.example

# 3. 配置 API Key
cp .env.example .env
vim .env  # 修改 API_KEYS（多个用逗号分隔）

# 4. 运行容器
docker run -d \
  --name 88code-reset \
  --env-file .env \
  --restart unless-stopped \
  -v $(pwd)/logs:/app/logs \
  huby11111/88code-reset-nodejs:latest

# 5. 查看日志
docker logs -f 88code-reset
```

### Docker Compose

```bash
# 1. 下载配置文件
wget https://raw.githubusercontent.com/2ue/88code-reset-nodejs/main/docker-compose.yml
wget https://raw.githubusercontent.com/2ue/88code-reset-nodejs/main/.env.example

# 2. 配置环境变量
cp .env.example .env
vim .env  # 修改 API_KEYS（多个用逗号分隔）

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

---

## 运行源码

```bash
# 1. 克隆项目
git clone https://github.com/2ue/88code-reset-nodejs.git
cd 88code-reset-nodejs

# 2. 安装依赖
pnpm install

# 3. 配置环境
cp .env.example .env
vim .env  # 修改 API_KEYS（多个用逗号分隔）

# 4. 启动服务（选择一种）
pnpm start                # 直接运行
pnpm run pm2:start        # PM2 守护进程（推荐生产环境）
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

### Q: 如果我自己手动重置了怎么办？

A: 系统会自动识别。如果18:55时检测到resetTimes<2，说明你已手动重置过，会跳过18:55的自动重置，23:56仍会执行。

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

A: 延迟重置是为了**最大化利用每日重置次数**，确保不浪费任何重置机会。

**场景说明：**
```
18:59 手动重置：使用第1次（理论额度 100 刀）
23:56 检查：冷却期还差3分钟，但 resetTimes=1
23:59 延迟触发：使用第2次（理论额度 150 刀）✅

如果没有延迟重置：
23:56 直接跳过，当日只用1次
损失：50 刀 ❌
```

**支持跨天执行：**
```
19:30 手动重置：使用第1次
00:00 系统刷新：resetTimes 恢复为2（第2次机会作废）
00:30 延迟重置执行：使用次日的第1次

结果：
- 当日实际获得 100 刀（初始50 + 手动重置50）
- 次日仍有2次重置机会，不影响次日的150刀上限
```

**配置说明：**
```env
COOLDOWN_HOURS=5         # 冷却期（小时）
```

### Q: 支持通知推送吗？

A: 支持 **Telegram Bot** 和 **企业微信机器人** 两种通知方式。

**配置 Telegram 通知：**
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

**配置企业微信通知：**
```env
WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```

**通知内容包括：**
- 启动成功通知（订阅状态分组显示）
- 重置结果通知（成功/失败/跳过统计）
- 延迟重置通知
- 余额格式：`剩余/限额 (百分比%)`
- 到期日期、重置次数等详细信息

**订阅状态分组显示：**
```
📊 活跃中订阅:
1. PLUS月卡 (月付)
   余额: 40.00/50.00 (80%)
   剩余次数: 2
   到期: 2025-12-01

⏸️ 已过期订阅:
2. PLUS月卡 (月付)
   余额: 10.00/50.00 (20%)
   到期: 2025-10-01
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

- Issue: [GitHub Issues](https://github.com/2ue/88code-reset-nodejs/issues)
- Email: jie746635835@163.com

---

**Happy Coding! 🚀**
