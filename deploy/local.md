# 本地部署指南

本文档介绍所有本地部署方式，包括 Docker 镜像、Docker Compose、源码编译和 PM2 守护进程。

---

## 🚀 方式1: Docker 镜像（推荐）

### 特点
- ✅ 无需编译，开箱即用
- ✅ 5分钟内快速启动
- ✅ 适合生产环境和 VPS 部署

### 快速开始

#### 1. 拉取镜像

```bash
# 从 Docker Hub 拉取（推荐，国内速度快）
docker pull huby11111/88code-reset-nodejs:latest

# 或从 GitHub Container Registry 拉取
docker pull ghcr.io/2ue/88code-reset-nodejs:latest
```

#### 2. 创建环境变量文件

```bash
cat > .env << EOF
# 必填配置
API_KEYS=88_your_key_here,88_another_key_here
API_BASE_URL=https://api.88code.com

# 可选配置
NODE_ENV=production
TZ=Asia/Shanghai
FIRST_RESET_TIME=18:55
SECOND_RESET_TIME=23:56
EOF
```

#### 3. 运行容器

```bash
docker run -d \
  --name 88code-reset \
  --env-file .env \
  --restart unless-stopped \
  -v $(pwd)/logs:/app/logs \
  huby11111/88code-reset-nodejs:latest
```

#### 4. 查看日志

```bash
# 实时查看日志
docker logs -f 88code-reset

# 查看最近100行
docker logs --tail 100 88code-reset
```

#### 5. 管理容器

```bash
# 停止容器
docker stop 88code-reset

# 启动容器
docker start 88code-reset

# 重启容器
docker restart 88code-reset

# 删除容器
docker rm -f 88code-reset
```

---

## 🐳 方式2: Docker Compose

### 特点
- ✅ 完整配置管理
- ✅ 一键启动/停止
- ✅ 适合本地开发和测试

### 快速开始

#### 1. 下载配置文件

```bash
# 下载 docker-compose.yml
wget https://raw.githubusercontent.com/2ue/88code-reset-nodejs/main/docker-compose.yml

# 或者克隆整个项目
git clone https://github.com/2ue/88code-reset-nodejs.git
cd 88code-reset-nodejs
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
vim .env  # 填入你的 API_KEYS
```

#### 3. 启动服务

```bash
# 启动（后台运行）
docker-compose up -d

# 或启动（前台运行，查看实时日志）
docker-compose up
```

#### 4. 管理服务

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose stop

# 停止并删除容器
docker-compose down

# 停止并删除容器、网络、卷
docker-compose down -v
```

---

## 📦 方式3: 源码编译部署

### 特点
- ✅ 完全控制，可自定义修改
- ✅ 适合开发和学习
- ✅ 无需 Docker 环境

### 前置要求

- Node.js 16+ (推荐 18 LTS)
- pnpm 7+ (或 npm 8+)

```bash
# 检查 Node.js 版本
node --version

# 安装 pnpm（如果还没有）
npm install -g pnpm
```

### 快速开始

#### 1. 克隆项目

```bash
git clone https://github.com/2ue/88code-reset-nodejs.git
cd 88code-reset-nodejs
```

#### 2. 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install
```

#### 3. 配置环境变量

```bash
cp .env.example .env
vim .env  # 填入你的 API_KEYS
```

#### 4. 测试运行

```bash
# 测试 API 连接
pnpm run test

# 或
npm run test
```

#### 5. 启动服务

```bash
# 生产模式运行
pnpm start

# 或开发模式（自动重启）
pnpm run dev
```

---

## 🔧 方式4: PM2 守护进程

### 特点
- ✅ 进程管理和监控
- ✅ 自动重启
- ✅ 适合生产环境

### 前置要求

完成方式3的步骤1-3（克隆项目、安装依赖、配置环境变量）

### 快速开始

#### 1. 安装 PM2

```bash
npm install -g pm2
```

#### 2. 启动服务

```bash
# 使用项目提供的 PM2 配置
pnpm run pm2:start

# 或手动启动
pm2 start src/index.js --name 88code-reset
```

#### 3. 管理服务

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs 88code-reset
pnpm run pm2:logs  # 或使用项目脚本

# 重启服务
pm2 restart 88code-reset

# 停止服务
pm2 stop 88code-reset
pnpm run pm2:stop  # 或使用项目脚本

# 删除服务
pm2 delete 88code-reset
```

#### 4. 开机自启动

```bash
# 保存当前 PM2 进程列表
pm2 save

# 生成开机启动脚本
pm2 startup
# 按照提示执行输出的命令
```

#### 5. 监控面板

```bash
# 查看实时监控
pm2 monit

# 或使用 Web 面板
pm2 plus
```

---

## 🔍 部署方式对比

| 特性 | Docker镜像 | Docker Compose | 源码编译 | PM2 |
|------|-----------|---------------|---------|-----|
| 启动速度 | ⚡⚡⚡⚡⚡ | ⚡⚡⚡⚡ | ⚡⚡⚡ | ⚡⚡⚡ |
| 配置难度 | ⭐ | ⭐ | ⭐⭐ | ⭐⭐ |
| 隔离性 | ✅ | ✅ | ❌ | ❌ |
| 资源占用 | 低 | 低 | 最低 | 最低 |
| 可定制性 | ❌ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 适用场景 | 快速部署 | 开发测试 | 深度定制 | 生产部署 |

---

## 💡 最佳实践

### 1. 日志管理

```bash
# Docker 方式：挂载日志目录
-v $(pwd)/logs:/app/logs

# PM2 方式：配置日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 2. 环境变量安全

```bash
# 不要提交 .env 到 Git
echo ".env" >> .gitignore

# 设置文件权限（仅所有者可读写）
chmod 600 .env
```

### 3. 健康检查

```env
# 启用健康检查服务
ENABLE_HEALTH_CHECK=true
HEALTH_CHECK_PORT=3000
```

```bash
# 访问健康检查端点
curl http://localhost:3000/health
```

### 4. 资源限制

```bash
# Docker 限制资源
docker run -d \
  --memory=256m \
  --cpus=0.5 \
  ...

# PM2 限制资源
pm2 start src/index.js \
  --name 88code-reset \
  --max-memory-restart 256M
```

---

## 🐛 常见问题

### Q: Docker 镜像拉取很慢？

A: 使用国内镜像加速或直接拉取 Docker Hub 镜像：
```bash
# 配置 Docker 镜像加速
vim /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn"
  ]
}

sudo systemctl restart docker
```

### Q: 端口冲突怎么办？

A: 修改健康检查端口：
```env
HEALTH_CHECK_PORT=3001  # 改为其他端口
```

### Q: 如何查看详细日志？

A:
```bash
# Docker
docker logs -f --tail 500 88code-reset

# PM2
pm2 logs 88code-reset --lines 500

# 源码运行
tail -f logs/combined.log
```

### Q: 如何更新到最新版本？

A:
```bash
# Docker 镜像
docker pull huby11111/88code-reset-nodejs:latest
docker stop 88code-reset
docker rm 88code-reset
# 重新运行容器

# Docker Compose
docker-compose pull
docker-compose up -d

# 源码编译
git pull origin main
pnpm install
pm2 restart 88code-reset
```

### Q: 如何备份数据？

A:
```bash
# 备份日志和配置
tar -czf backup-$(date +%Y%m%d).tar.gz \
  .env logs/

# 恢复
tar -xzf backup-20250106.tar.gz
```

---

## 📚 相关资源

- [主项目 README](../README.md)
- [环境变量配置](../.env.example)
- [Docker 部署详细文档](./docker.md)
- [云平台部署](./README.md)

---

## 💬 获取帮助

遇到问题？
- 查看 [常见问题](../README.md#常见问题)
- 提交 [GitHub Issue](https://github.com/2ue/88code-reset-nodejs/issues)
- 查看项目 [Wiki](https://github.com/2ue/88code-reset-nodejs/wiki)
