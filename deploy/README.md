# 部署方案总览

88code-reset-nodejs 支持多种本地部署方式，包括 Docker、Docker Compose、PM2 守护进程等。

---

## 📋 部署方式对比

### 本地部署

| 方式 | 难度 | 推荐度 | 适合场景 |
|------|------|--------|---------|
| **Docker 镜像** | ⭐ | ⭐⭐⭐⭐⭐ | 快速启动、VPS部署、生产环境 |
| **Docker Compose** | ⭐ | ⭐⭐⭐⭐⭐ | 完整配置、本地开发 |
| **源码编译** | ⭐⭐ | ⭐⭐⭐⭐ | 自定义修改、学习研究 |
| **PM2 守护进程** | ⭐⭐ | ⭐⭐⭐⭐ | Node.js 原生部署 |

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

#### 场景4: 已有 VPS
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
| `FIRST_RESET_TIME` | 首次重置时间 | `18:55` |
| `SECOND_RESET_TIME` | 二次重置时间 | `23:56` |
| `COOLDOWN_HOURS` | 冷却期（小时） | `5` |
| `END_OF_DAY_BUFFER` | 延迟重置缓冲时间（秒） | `10` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `LOG_MAX_SIZE` | 单个日志文件最大大小(MB) | `10` |
| `LOG_MAX_DAYS` | 日志保留天数 | `30` |

完整配置参考 [.env.example](../.env.example)

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
| PM2/源码运行 | 持久化到本地文件系统 |

### 3. 监控和告警

- **Docker**: 使用 `docker stats` 监控资源
- **PM2**: 使用 `pm2 monit` 查看进程状态

### 4. 备份策略

持久化数据建议备份：
```bash
# 本地部署
tar -czf backup.tar.gz logs/ data/
```

---

## 🐛 常见问题

### Q: 部署后没有执行任务？

A: 检查以下几点：
1. 环境变量是否正确配置
2. 查看日志确认调度器是否启动

### Q: 如何验证部署成功？

A: 查看日志输出：
```
[INFO] ========== 88code 自动重置服务启动 ==========
[INFO] 已配置账号数量: 2
[INFO] 首次重置时间: 18:55
[INFO] 二次重置时间: 23:56
[INFO] 下次重置时间: 2025-11-06 18:55:00
```

### Q: 多个服务器同时部署会冲突吗？

A: 会！同一个 API_KEY 不要在多个服务器同时运行，会导致：
- 重复重置
- 冷却期冲突
- API 限流

### Q: 如何切换部署方式？

A:
1. 停止当前的服务
2. 使用新的部署方式启动
3. 确认新服务运行正常
4. 清理旧服务的资源

---

## 📚 相关资源

- [主项目 README](../README.md)
- [环境变量示例](../.env.example)
- [Dockerfile](../Dockerfile)
- [Docker Compose 配置](../docker-compose.yml)

---

## 💬 获取帮助

遇到问题？
- 查看对应部署方式的详细文档
- 提交 [GitHub Issue](https://github.com/2ue/88code-reset-nodejs/issues)
- 查看项目 [常见问题](../README.md#常见问题)
