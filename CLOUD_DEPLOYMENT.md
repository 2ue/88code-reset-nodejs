# 🌐 云端平台部署完整指南

本文档详细介绍如何在各大云平台部署 88code-reset-nodejs，包括 Railway、Render、Fly.io 等主流平台的一键部署和手动部署方式。

---

## 📋 目录

- [快速选择平台](#-快速选择平台)
- [Railway 部署](#railway-部署)
- [Render 部署](#render-部署)
- [Fly.io 部署](#flyio-部署)
- [其他云平台](#其他云平台)
- [成本对比](#成本对比)
- [迁移指南](#迁移指南)
- [故障排除](#故障排除)

---

## 🎯 快速选择平台

### 按需求选择

| 需求场景 | 推荐平台 | 理由 |
|---------|---------|------|
| **完全零配置** | Railway | 一键部署，自动检测配置 |
| **GitHub 集成** | Render | Blueprint 自动化，代码提交即部署 |
| **全球加速** | Fly.io | 多区域部署，就近访问 |
| **长期免费运行** | Railway / Fly.io | 免费额度充足，无隐藏费用 |
| **调试方便** | Railway | 内置日志查看，实时监控 |

### 免费额度对比

| 平台 | 计算资源 | 存储 | 流量 | 限制 | 实际成本 |
|------|---------|------|------|------|---------|
| **Railway** | $5/月 (500h) | 1GB | 100GB/月 | 无限请求 | **$0** ✅ |
| **Render** | 750h/月 | 1GB (免费) | 100GB/月 | 750h/月 | **$0-2** |
| **Fly.io** | 3个共享CPU VM | 3GB | 100GB/月 | 160GB共享存储 | **$0** ✅ |

---

## 🚀 Railway 部署（推荐）

### 方式1：一键部署（最简单）

1. **Fork 仓库**
   ```bash
   # 访问 GitHub 页面，点击 Fork 按钮
   https://github.com/2ue/88code-reset-nodejs
   ```

2. **一键部署**
   - 点击下方按钮：

   [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)

3. **配置环境变量**
   ```
   API_KEYS=88_your_api_key_here
   NODE_ENV=production
   TZ=Asia/Shanghai
   ```

4. **等待部署完成**
   - Railway 会自动检测 Dockerfile
   - 部署时间约 2-3 分钟
   - 部署成功后获得应用 URL

### 方式2：Railway CLI 部署

1. **安装 Railway CLI**
   ```bash
   npm install -g @railway/cli
   # 或
   curl -fsSL https://railway.app/install.sh | sh
   ```

2. **登录**
   ```bash
   railway login
   ```

3. **初始化项目**
   ```bash
   git clone https://github.com/YOUR_USERNAME/88code-reset-nodejs.git
   cd 88code-reset-nodejs
   railway init
   ```

4. **配置环境变量**
   ```bash
   railway variables set API_KEYS=88_your_key_here
   railway variables set NODE_ENV=production
   railway variables set TZ=Asia/Shanghai
   ```

5. **部署**
   ```bash
   railway up
   ```

### Railway 管理界面

- **应用监控**：[railway.app/dashboard](https://railway.app/dashboard)
- **日志查看**：应用页面 → Logs 标签
- **环境变量**：应用页面 → Variables 标签
- **部署历史**：应用页面 → Deployments 标签

### Railway 优势

- ✅ **完全免费**：$5/月 额度足够运行
- ✅ **零配置**：自动检测 Dockerfile
- ✅ **自动重启**：崩溃后自动恢复
- ✅ **持久化存储**：免费 1GB 存储
- ✅ **自定义域名**：支持绑定自定义域名
- ✅ **团队协作**：支持多人协作

---

## 🎨 Render 部署

### 方式1：一键部署

1. **Fork 仓库**
   ```bash
   # 访问并 Fork
   https://github.com/2ue/88code-reset-nodejs
   ```

2. **一键部署**
   - 点击下方按钮：

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

3. **配置服务**
   - 选择 Fork 的仓库
   - 选择 `Docker` 环境
   - 设置服务名称
   - 配置环境变量

4. **部署**
   - Render 会自动构建和部署
   - 部署时间约 3-5 分钟

### 方式2：Render Dashboard 部署

1. **注册 Render 账号**
   - 访问：[render.com](https://render.com)
   - 使用 GitHub 账号登录

2. **创建新服务**
   - Dashboard → New → Web Service
   - 连接 GitHub 仓库
   - 选择 Fork 的 `88code-reset-nodejs` 仓库

3. **配置服务**
   ```yaml
   Name: 88code-reset
   Environment: Docker
   Region: Oregon (US West)  # 或选择离你最近的区域
   Branch: main
   Root Directory: ./
   ```

4. **设置环境变量**
   ```
   API_KEYS=88_your_key_here
   NODE_ENV=production
   TZ=Asia/Shanghai
   ```

5. **创建服务**
   - 点击 "Create Web Service"
   - 等待自动部署完成

### Render Blueprint 配置

项目已包含 `render.yaml` 配置文件，支持 Blueprint 自动化：

```yaml
services:
  - type: web
    name: 88code-reset
    env: docker
    plan: free
    envVars:
      - key: API_KEYS
        sync: false
      - key: NODE_ENV
        value: production
      - key: TZ
        value: Asia/Shanghai
```

### Render 优势

- ✅ **GitHub 集成**：代码提交自动部署
- ✅ **Blueprint 配置**：GitOps 工作流
- ✅ **预览环境**：每个 PR 自动生成预览环境
- ✅ **HTTPS 支持**：自动配置 SSL 证书
- ✅ **监控告警**：内置健康检查和告警

---

## ✈️ Fly.io 部署

### 前置要求

1. **Fork 仓库到 GitHub**
2. **安装 Fly.io CLI**

### 安装 CLI

```bash
# Linux/macOS
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# 验证安装
flyctl version
```

### 部署步骤

1. **登录 Fly.io**
   ```bash
   flyctl auth login
   # 会打开浏览器完成登录
   ```

2. **克隆仓库**
   ```bash
   git clone https://github.com/YOUR_USERNAME/88code-reset-nodejs.git
   cd 88code-reset-nodejs
   ```

3. **初始化应用**
   ```bash
   flyctl launch
   ```

   配置选项：
   ```bash
   ? App Name (leave blank to use an auto-generated name): 88code-reset
   ? Select organization: personal
   ? Select region: sjc (San Jose)  # 选择离你最近的区域
   ? Would you like to setup a PostgreSQL database now? No
   ? Would you like to deploy now? No
   ```

4. **配置环境变量**
   ```bash
   flyctl secrets set API_KEYS=88_your_key_here,88_another_key
   flyctl secrets set NODE_ENV=production
   flyctl secrets set TZ=Asia/Shanghai
   flyctl secrets set API_BASE_URL=https://api.88code.com
   ```

5. **配置持久化存储**
   ```bash
   # 创建持久化卷（用于日志存储）
   flyctl volumes create logs_data --size 1 --region sjc
   ```

6. **更新 fly.toml 配置**
   ```toml
   app = "88code-reset"

   [build]
     dockerfile = "Dockerfile"

   [env]
     NODE_ENV = "production"
     TZ = "Asia/Shanghai"

   [[services]]
     protocol = "tcp"
     internal_port = 8080

     [[services.ports]]
       port = 80

     [services.concurrency]
       type = "connections"
       hard_limit = 25
       soft_limit = 20

     [[services.http_checks]]
       interval = 15000
       grace_period = "5s"
       method = "get"
       path = "/health"
       protocol = "http"
       timeout = 2000

   [[mounts]]
     destination = "/app/logs"
     source = "logs_data"
   ```

7. **部署应用**
   ```bash
   flyctl deploy
   ```

8. **验证部署**
   ```bash
   # 查看应用状态
   flyctl status

   # 查看日志
   flyctl logs

   # 访问应用
   flyctl open
   ```

### Fly.io 优势

- ✅ **全球部署**：支持多区域部署
- ✅ **免费额度**：3个免费 VM + 160GB 共享存储
- ✅ **持久化存储**：免费卷存储支持
- ✅ **自动扩展**：支持自动扩缩容
- ✅ **就近访问**：CDN 加速，低延迟

---

## 🌟 其他云平台

### Vercel 部署

虽然 Vercel 主要面向前端应用，但也可以部署 Node.js 应用：

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel --prod

# 4. 配置环境变量
vercel env add API_KEYS production
vercel env add NODE_ENV production
vercel env add TZ production
```

### AWS 部署

使用 AWS App Runner 或 ECS：

```bash
# 1. 构建 Docker 镜像
docker build -t 88code-reset .

# 2. 推送到 ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-west-2.amazonaws.com
docker tag 88code-reset:latest ACCOUNT.dkr.ecr.us-west-2.amazonaws.com/88code-reset:latest
docker push ACCOUNT.dkr.ecr.us-west-2.amazonaws.com/88code-reset:latest

# 3. 部署到 App Runner
aws apprunner create-service \
  --service-name 88code-reset \
  --source-configuration '{"ImageRepository":{"ImageIdentifier":"ACCOUNT.dkr.ecr.us-west-2.amazonaws.com/88code-reset:latest","ImageConfiguration":{"Port":8080}}}' \
  --auto-scaling-configuration '{"MinSize":1,"MaxSize":2,"DesiredConcurrency":25}'
```

### Google Cloud Run

```bash
# 1. 构建 Docker 镜像
gcloud builds submit --tag gcr.io/PROJECT-ID/88code-reset

# 2. 部署到 Cloud Run
gcloud run deploy 88code-reset \
  --image gcr.io/PROJECT-ID/88code-reset \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,TZ=Asia/Shanghai
```

---

## 💰 成本对比

### 月度运行成本（24/7 运行）

| 平台 | 计算成本 | 存储成本 | 流量成本 | **总成本** | 性价比 |
|------|---------|---------|---------|-----------|--------|
| **Railway** | $0 (使用$5额度) | $0 (1GB免费) | $0 (100GB免费) | **$0** ✅ | ⭐⭐⭐⭐⭐ |
| **Render** | $0 (750h免费) | $1 (1GB) | $0 (100GB免费) | **$1** | ⭐⭐⭐⭐ |
| **Fly.io** | $0 (3个免费VM) | $0 (3GB免费) | $0 (100GB免费) | **$0** ✅ | ⭐⭐⭐⭐⭐ |
| **Vercel** | $0 (Hobby) | $0 | $0 (100GB免费) | **$0** | ⭐⭐⭐ |
| **AWS App Runner** | ~$7/mo | ~$1/mo | ~$2/mo | **$10** | ⭐⭐ |

### 性能对比

| 平台 | 启动时间 | 稳定性 | 监控 | 调试难度 |
|------|---------|--------|------|----------|
| **Railway** | 2-3分钟 | ⭐⭐⭐⭐⭐ | 内置监控 | ⭐ 简单 |
| **Render** | 3-5分钟 | ⭐⭐⭐⭐ | 内置监控 | ⭐⭐ 简单 |
| **Fly.io** | 3-4分钟 | ⭐⭐⭐⭐⭐ | CLI监控 | ⭐⭐⭐ 中等 |
| **Vercel** | 1-2分钟 | ⭐⭐⭐ | Dashboard | ⭐⭐ 简单 |

---

## 🔄 迁移指南

### 从本地迁移到云平台

#### 步骤1：备份本地数据
```bash
# 备份配置文件
cp .env .env.backup

# 备份日志数据
tar -czf logs-backup.tar.gz logs/
```

#### 步骤2：选择云平台
根据前面的对比表选择合适的云平台。

#### 步骤3：配置环境变量
在云平台 Dashboard 中配置相同的环境变量：
```env
API_KEYS=88_your_key_here
NODE_ENV=production
TZ=Asia/Shanghai
API_BASE_URL=https://api.88code.com
FIRST_RESET_TIME=18:55
SECOND_RESET_TIME=23:56
```

#### 步骤4：部署应用
按照对应平台的部署步骤进行部署。

#### 步骤5：验证迁移
```bash
# 查看启动日志
# 期望看到：
[INFO] ========== 88code 自动重置服务启动 ==========
[INFO] 已配置账号数量: X
[INFO] 首次重置时间: 18:55
[INFO] 二次重置时间: 23:56
[INFO] 下次重置时间: 2025-11-06 18:55:00
```

### 在云平台间迁移

由于所有平台都使用相同的 Dockerfile 和环境变量，迁移成本很低：

1. **导出环境变量**
   ```bash
   # 从原平台导出配置
   # Railway: Dashboard → Variables
   # Render: Dashboard → Environment
   # Fly.io: flyctl secrets list
   ```

2. **在新平台创建应用**
   ```bash
   # 按照对应平台文档创建新应用
   ```

3. **复制配置**
   ```bash
   # 在新平台设置相同的环境变量
   ```

4. **部署验证**
   ```bash
   # 部署后验证服务正常
   # 停止旧平台服务
   ```

**迁移时间**：约 10-15 分钟
**停机时间**：约 2-3 分钟（部署切换期间）

---

## 🔧 故障排除

### 通用问题

#### Q: 部署后没有执行任务？

**可能原因**：
1. 环境变量配置错误
2. 时区设置不正确
3. API Keys 格式错误

**排查步骤**：
```bash
# 1. 检查环境变量
# Railway: Dashboard → Variables
# Render: Dashboard → Environment
# Fly.io: flyctl secrets list

# 2. 查看应用日志
# 期望看到启动信息：
[INFO] 服务启动成功
[INFO] 已配置账号数量: X
[INFO] 下次重置时间: YYYY-MM-DD HH:MM:SS
```

#### Q: 如何验证环境变量正确？

```bash
# 在云平台设置临时测试变量
ENABLE_HEALTH_CHECK=true
HEALTH_CHECK_PORT=3000

# 访问健康检查端点
https://your-app-url/health

# 期望返回：
{
  "status": "healthy",
  "uptime": 86400,
  "lastReset": "2025-11-06T15:55:00Z",
  "nextReset": "2025-11-06T18:55:00Z"
}
```

### 平台特定问题

#### Railway 问题

**Q: Railway 部署失败**

```bash
# 检查 Dockerfile 是否存在
ls -la Dockerfile

# 检查 Dockerfile 语法
docker build -t test .

# 查看 Railway 构建日志
# Dashboard → Deployments → 选择部署 → 查看日志
```

#### Render 问题

**Q: Render 启动失败**

```bash
# 检查 render.yaml 配置
cat render.yaml

# 确保 Docker 暴露端口正确
# Dockerfile 应包含：EXPOSE 8080
# 应用应监听：process.env.PORT || 8080
```

#### Fly.io 问题

**Q: Fly.io 应用无法访问**

```bash
# 检查应用状态
flyctl status

# 检查服务配置
cat fly.toml

# 重新部署
flyctl deploy --strategy immediate
```

### 监控和告警

#### Railway 监控
- **Dashboard**：实时查看应用状态
- **Logs**：实时日志流
- **Metrics**：CPU、内存使用情况
- **Alerts**：设置邮件告警

#### Render 监控
- **Dashboard**：应用概览
- **Logs**：构建和运行日志
- **Metrics**：性能指标
- **Incidents**：故障报告

#### Fly.io 监控
```bash
# 查看实时日志
flyctl logs --follow

# 查看应用指标
flyctl metrics

# 检查应用健康状态
flyctl status
```

---

## 📚 参考资源

### 官方文档
- **[Railway 文档](https://docs.railway.app)**
- **[Render 文档](https://render.com/docs)**
- **[Fly.io 文档](https://fly.io/docs)**

### 相关链接
- **[项目主仓库](https://github.com/2ue/88code-reset-nodejs)**
- **[部署方案总览](./deploy/README.md)**
- **[环境变量配置](./.env.example)**
- **[Dockerfile 参考](./Dockerfile)**

### 获取帮助
- **[GitHub Issues](https://github.com/2ue/88code-reset-nodejs/issues)**：报告问题
- **[Discord 社区](https://discord.gg/)**：交流讨论
- **邮件支持**：jie746635835@163.com

---

## 🎉 总结

选择合适的云平台部署 88code-reset-nodejs：

| 推荐度 | 平台 | 适合用户 |
|--------|------|---------|
| ⭐⭐⭐⭐⭐ | **Railway** | 追求简单、零配置的用户 |
| ⭐⭐⭐⭐ | **Render** | 重视 GitHub 集成的开发者 |
| ⭐⭐⭐⭐⭐ | **Fly.io** | 需要全球加速的用户 |
| ⭐⭐⭐ | **Vercel** | 已在使用 Vercel 的前端开发者 |

所有推荐平台都支持 **完全免费** 长期运行，选择任何一个都可以满足需求。建议优先选择 **Railway**，因为它最简单易用且功能完整。