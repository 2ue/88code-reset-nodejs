# 部署方案总览

88code-reset-nodejs 支持多种部署方式，从本地 Docker 到云平台一键部署。

---

## 📋 部署方式对比

### 本地部署

| 方式 | 难度 | 推荐度 | 适合场景 |
|------|------|--------|---------|
| **Docker 镜像** | ⭐ | ⭐⭐⭐⭐⭐ | 快速启动、VPS部署、生产环境 |
| **Docker Compose** | ⭐ | ⭐⭐⭐⭐⭐ | 完整配置、本地开发 |
| **源码编译** | ⭐⭐ | ⭐⭐⭐⭐ | 自定义修改、学习研究 |
| **PM2 守护进程** | ⭐⭐ | ⭐⭐⭐⭐ | Node.js 原生部署 |

### 云平台部署

| 平台 | 免费额度 | 持久化存储 | 复杂度 | 推荐度 | 适合场景 |
|------|---------|-----------|--------|--------|---------|
| [Railway](./railway.md) | $5/月 (500h) | ✅ 免费 | ⭐ 简单 | ⭐⭐⭐⭐⭐ | 一键部署、零配置 |
| [Render](./render.md) | 750h/月 | 💰 付费 | ⭐⭐ 简单 | ⭐⭐⭐⭐ | Blueprint自动化 |
| [Fly.io](./fly.md) | 3 VM + 160GB | ✅ 免费 | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐⭐ | 全球部署、高可用 |

---

## 🎯 快速选择

### 我应该选择哪种部署方式？

#### 场景1: 快速体验（5分钟内启动）
**推荐**: Docker 镜像
```bash
docker pull huby11111/88code-reset-nodejs:latest
docker run -d --env-file .env huby11111/88code-reset-nodejs:latest
```
- ✅ 无需编译
- ✅ 开箱即用
- ✅ 最快速度

#### 场景2: 本地开发测试
**推荐**: Docker Compose 或源码编译
```bash
# Docker Compose
docker-compose up -d

# 或源码运行
pnpm install && pnpm start
```
- ✅ 完整配置
- ✅ 方便调试
- ✅ 无网络依赖

#### 场景3: VPS/服务器部署
**推荐**: Docker 镜像 + PM2
```bash
# Docker 方式
docker run -d --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  huby11111/88code-reset-nodejs:latest

# 或 PM2 方式
pnpm install && pm2 start src/index.js --name 88code-reset
pm2 save && pm2 startup
```

#### 场景4: 个人使用，需要长期稳定运行
**推荐**: [Railway](./railway.md) 或 [Render](./render.md)
- 一键部署
- 自动重启
- 免运维

#### 场景5: 需要全球加速
**推荐**: [Fly.io](./fly.md)
- 多区域部署
- 自动扩展
- 持久化存储免费

#### 场景6: 已有 VPS
**推荐**: [Docker](./docker.md)
```bash
# 拉取镜像
docker pull huby11111/88code-reset-nodejs:latest

# 运行容器
docker run -d --env-file .env \
  --restart unless-stopped \
  huby11111/88code-reset-nodejs:latest
```

---

## 🚀 快速开始

### 通用准备工作

所有部署方式都需要配置 API 密钥：

```env
# 必填
API_KEYS=88_your_key_here,88_another_key_here
API_BASE_URL=https://api.88code.com

# 可选
NODE_ENV=production
TZ=Asia/Shanghai
FIRST_RESET_TIME=18:55
SECOND_RESET_TIME=23:56
```

---

## 📖 详细文档

点击查看各平台详细部署指南：

### 本地部署
- [**本地部署完整指南**](./local.md) - 所有本地部署方式
  - Docker 镜像（推荐）
  - Docker Compose
  - 源码编译
  - PM2 守护进程

### 容器化部署
- [**Docker 部署**](./docker.md) - Docker 容器详细配置
  - Dockerfile 说明
  - 多阶段构建
  - 健康检查和日志管理

### 云平台部署
- [**Railway 部署**](./railway.md) - 最简单的云部署
  - 自动检测 Dockerfile
  - Dashboard 和 CLI 两种方式
  - 持久化存储支持

- [**Render 部署**](./render.md) - Blueprint 自动化部署
  - 750小时/月免费额度
  - 自动构建和部署
  - GitHub 集成

- [**Fly.io 部署**](./fly.md) - 全球分布式部署
  - 3个免费 VM
  - 多区域支持
  - 持久化卷存储

---

## ⚙️ 环境变量说明

### 必需配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `API_KEYS` | 88code API密钥（多个用逗号分隔） | `88_xxx,88_yyy` |
| `API_BASE_URL` | API地址 | `https://api.88code.com` |

### 可选配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `TZ` | 时区 | `Asia/Shanghai` |
| `FIRST_RESET_TIME` | 首次重置时间 | `18:55` |
| `SECOND_RESET_TIME` | 二次重置时间 | `23:56` |
| `COOLDOWN_HOURS` | 冷却期（小时） | `5` |
| `END_OF_DAY_BUFFER` | 延迟重置缓冲时间（秒） | `10` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `LOG_MAX_SIZE` | 单个日志文件最大大小(MB) | `10` |
| `LOG_MAX_DAYS` | 日志保留天数 | `30` |

完整配置参考 [.env.example](../.env.example)

---

## 💰 成本对比

### 每月运行成本（24/7）

| 平台 | 计算资源 | 存储 | 总成本 |
|------|---------|------|--------|
| Docker (本地) | 自备硬件 | ✅ 免费 | $0 |
| Railway | ✅ 免费 ($5额度) | ✅ 免费 | **$0** ✅ |
| Render | ✅ 免费 (750h) | 💰 $1/GB | **$0-2** |
| Fly.io | ✅ 免费 (3 VM) | ✅ 免费 (3GB) | **$0** ✅ |

**推荐零成本方案**：
1. **Railway** - 最简单，适合长期运行
2. **Fly.io** - 全球加速，高可用

---

## 🎯 迁移指南

### 从本地 Docker 迁移到云平台

#### 步骤1: 导出环境变量
```bash
# 查看当前配置
cat .env
```

#### 步骤2: 在云平台配置
参考各平台文档，设置相同的环境变量。

#### 步骤3: 停止本地容器
```bash
docker-compose down
```

#### 步骤4: 部署到云平台
按照对应平台文档操作。

### 在多个平台间切换

各平台使用相同的 Dockerfile 和环境变量配置，可以随时切换：
- Railway ↔ Render ↔ Fly.io
- 配置迁移成本：~5分钟

---

## 🛡️ 最佳实践

### 1. 环境变量管理

✅ **正确做法**：
- 使用平台的 Secrets/Variables 功能
- 本地使用 `.env` 文件（不提交到 Git）

❌ **错误做法**：
- 将 API_KEYS 写在代码中
- 提交 `.env` 到 Git 仓库

### 2. 日志管理

根据部署方式选择日志策略：

| 部署方式 | 日志策略 |
|---------|---------|
| Docker 本地 | 持久化到宿主机 |
| 云平台（有存储） | 持久化到卷 |
| 云平台（无存储） | 仅控制台输出 |

### 3. 监控和告警

- **Railway/Render/Fly.io**: 启用平台内置监控
- **Docker**: 使用 `docker stats` 监控资源

### 4. 备份策略

持久化数据建议备份：
```bash
# Docker
tar -czf backup.tar.gz logs/ data/

# 云平台
使用平台提供的快照功能
```

### 4. 成本控制

- 定期检查资源使用量
- 关闭不用的实例
- 利用免费额度

---

## 🐛 常见问题

### Q: 部署后没有执行任务？

A: 检查以下几点：
1. 环境变量是否正确配置
2. 时区设置是否为 `Asia/Shanghai`
3. 查看日志确认调度器是否启动

### Q: 如何验证部署成功？

A: 查看日志输出：
```
[INFO] ========== 88code 自动重置服务启动 ==========
[INFO] 已配置账号数量: 2
[INFO] 首次重置时间: 18:55
[INFO] 二次重置时间: 23:56
[INFO] 下次重置时间: 2025-11-06 18:55:00
```

### Q: 多个平台同时部署会冲突吗？

A: 会！同一个 API_KEY 不要在多个平台同时运行，会导致：
- 重复重置
- 冷却期冲突
- API 限流

### Q: 如何切换部署平台？

A:
1. 停止当前平台的服务
2. 在新平台部署
3. 确认新平台运行正常
4. 删除旧平台的服务

---

## 📚 相关资源

- [主项目 README](../README.md)
- [环境变量示例](../.env.example)
- [Dockerfile](../Dockerfile)
- [Docker Compose 配置](../docker-compose.yml)

---

## 💬 获取帮助

遇到问题？
- 查看对应平台的详细文档
- 提交 [GitHub Issue](https://github.com/2ue/88code-reset-nodejs/issues)
- 查看项目 [常见问题](../README.md#常见问题)
