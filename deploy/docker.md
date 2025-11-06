# Docker 部署指南

使用 Docker 部署 88code-reset-nodejs，开箱即用。

---

## 📦 准备工作

### 1. 安装 Docker

```bash
# Linux (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh

# macOS
brew install docker

# 或下载 Docker Desktop
# https://www.docker.com/products/docker-desktop
```

### 2. 配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置文件
nano .env
```

必填配置：
```env
API_KEYS=88_your_key_here,88_another_key_here
API_BASE_URL=https://api.88code.com
```

---

## 🚀 快速开始

### 方式1: Docker Compose（推荐）

#### 使用远程镜像（推荐）

```bash
# 1. 启动容器
docker-compose up -d

# 2. 查看日志
docker-compose logs -f

# 3. 停止容器
docker-compose down
```

#### 使用本地源码构建

```bash
# 1. 本地构建并启动
docker-compose -f docker-compose.local.yml up -d

# 2. 查看日志
docker-compose -f docker-compose.local.yml logs -f

# 3. 停止容器
docker-compose -f docker-compose.local.yml down
```

### 方式2: 手动运行

#### 拉取镜像

```bash
# 拉取最新镜像
docker pull huby11111/88code-reset-nodejs:latest

# 运行容器
docker run -d \
  --name 88code-reset \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  huby11111/88code-reset-nodejs:latest
```

#### 本地构建

```bash
# 构建镜像
docker build -t 88code-reset-nodejs:local .

# 运行容器
docker run -d \
  --name 88code-reset \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  88code-reset-nodejs:local
```

---

## 🛠️ Docker 常用命令

### 容器管理

```bash
# 查看容器状态
docker ps -a | grep 88code-reset

# 启动容器
docker start 88code-reset

# 停止容器
docker stop 88code-reset

# 重启容器
docker restart 88code-reset

# 删除容器
docker rm 88code-reset

# 进入容器
docker exec -it 88code-reset sh
```

### 日志查看

```bash
# 查看实时日志
docker logs -f 88code-reset

# 查看最后100行
docker logs --tail 100 88code-reset

# 查看带时间戳的日志
docker logs -t 88code-reset
```

### 资源监控

```bash
# 查看资源使用
docker stats 88code-reset

# 查看容器详细信息
docker inspect 88code-reset
```

---

## 📂 持久化数据

容器会自动挂载以下目录到宿主机：

```
./logs  → /app/logs   # 日志文件
./data  → /app/data   # 历史数据
```

目录会在首次运行时自动创建。

---

## 🏥 健康检查

Docker 会自动监控容器健康状态：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' 88code-reset
```

状态说明：
- `healthy`: 运行正常 ✅
- `unhealthy`: 运行异常 ❌
- `starting`: 启动中 ⏳

健康检查配置（Dockerfile）：
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "process.exit(0)"
```

---

## 🔄 更新镜像

### 使用远程镜像

```bash
# 1. 停止并删除旧容器
docker-compose down

# 2. 拉取最新镜像
docker-compose pull

# 3. 启动新容器
docker-compose up -d
```

### 使用本地构建

```bash
# 1. 停止并删除旧容器
docker-compose -f docker-compose.local.yml down

# 2. 重新构建（不使用缓存）
docker-compose -f docker-compose.local.yml build --no-cache

# 3. 启动新容器
docker-compose -f docker-compose.local.yml up -d
```

---

## 📊 镜像信息

- **基础镜像**: `node:18.20-alpine`
- **包管理器**: `pnpm 7.30.1`
- **镜像大小**: ~100MB（多阶段构建优化）
- **时区**: `Asia/Shanghai`
- **工作目录**: `/app`

### 构建架构

支持多平台：
- `linux/amd64` - x86_64 架构
- `linux/arm64` - ARM64 架构（Apple Silicon）

---

## 🐛 故障排查

### 容器无法启动

```bash
# 1. 查看容器日志
docker logs 88code-reset

# 2. 检查环境变量
docker exec 88code-reset env | grep API

# 3. 检查配置文件
docker exec 88code-reset cat /app/.env
```

### 日志不输出

```bash
# 1. 确认挂载目录权限
ls -la logs/

# 2. 进入容器检查
docker exec -it 88code-reset sh
ls -la /app/logs
```

### 时区不正确

```bash
# 确认容器时区设置
docker exec 88code-reset date
docker exec 88code-reset cat /etc/localtime
```

应该显示 `CST`（中国标准时间）。

---

## 💡 最佳实践

### 1. 使用 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  88code-reset:
    container_name: 88code-reset
    image: huby11111/88code-reset-nodejs:latest
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
```

### 2. 环境隔离

```bash
# 生产环境
docker-compose up -d

# 开发环境
docker-compose -f docker-compose.local.yml up -d
```

### 3. 日志轮转

容器内已配置自动日志轮转：
```env
LOG_MAX_SIZE=10    # 单文件最大10MB
LOG_MAX_DAYS=30    # 保留30天
```

### 4. 资源限制

编辑 `docker-compose.yml` 添加资源限制：

```yaml
services:
  88code-reset:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
```

---

## 📚 相关资源

- [Dockerfile 参考](../Dockerfile)
- [docker-compose.yml 配置](../docker-compose.yml)
- [Docker Hub 镜像](https://hub.docker.com/r/huby11111/88code-reset-nodejs)
- [环境变量配置](../.env.example)
