# Railway 部署指南

Railway 是最简单的部署方式，支持自动检测 Dockerfile，一键部署。

---

## ✨ 特点

- ✅ 最简单，一键部署
- ✅ 自动检测 Dockerfile
- ✅ $5/月免费额度（约500小时）
- ✅ 持久化存储支持
- ✅ 自动重启和健康检查

---

## 🚀 部署步骤

### 1. 注册账号

访问 https://railway.app 注册账号

### 2. 创建新项目

1. 点击 **"New Project"**
2. 选择 **"Deploy from GitHub repo"**
3. 授权 Railway 访问你的 GitHub
4. 选择 `88code-reset-nodejs` 仓库

### 3. 配置环境变量

Railway 会自动检测到 `railway.toml` 和 `Dockerfile`。

点击项目 → **Variables** 标签页，添加环境变量：

```env
API_KEYS=88_your_key_here,88_another_key_here
API_BASE_URL=https://api.88code.com
```

可选配置：
```env
NODE_ENV=production
TZ=Asia/Shanghai
FIRST_RESET_TIME=18:55
SECOND_RESET_TIME=23:56
```

### 4. 自动部署

Railway 会自动：
- 检测 `railway.toml` 配置
- 使用 Dockerfile 构建镜像
- 启动容器
- 监控健康状态

### 5. 查看日志

1. 点击项目
2. 选择 **Deployments** 标签页
3. 点击最新部署
4. 查看 **View Logs**

---

## 🛠️ Railway CLI 部署（可选）

### 安装 CLI

```bash
# npm
npm install -g @railway/cli

# 或使用 brew (macOS)
brew install railway
```

### 登录

```bash
railway login
```

### 初始化项目

```bash
# 在项目目录下运行
cd 88code-reset-nodejs

# 初始化（如果是新项目）
railway init

# 链接到现有项目
railway link
```

### 设置环境变量

```bash
# 设置单个变量
railway variables set API_KEYS=88_xxx,88_yyy

# 批量设置
railway variables set \
  API_KEYS=88_xxx,88_yyy \
  API_BASE_URL=https://api.88code.com \
  NODE_ENV=production

# 查看已设置的变量
railway variables
```

### 部署

```bash
# 部署到 Railway
railway up

# 查看部署状态
railway status
```

### 查看日志

```bash
# 实时查看日志
railway logs

# 查看历史日志
railway logs --tail 100
```

### 其他常用命令

```bash
# 查看项目信息
railway info

# 连接到项目
railway link

# 断开连接
railway unlink

# 打开项目 Dashboard
railway open
```

---

## ⚙️ railway.toml 配置说明

项目已包含 `railway.toml` 配置文件：

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
# 注意：使用 Dockerfile 部署时，startCommand 会被 Dockerfile 的 CMD 覆盖
# 实际启动命令在 Dockerfile line 56: CMD ["node", "src/index.js"]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**说明**：
- `builder = "DOCKERFILE"`: 使用 Dockerfile 构建
- `restartPolicyType = "ON_FAILURE"`: 失败时自动重启
- `restartPolicyMaxRetries = 10`: 最多重试10次

**重要**：railway.toml 不支持直接配置环境变量，必须通过 Dashboard 或 CLI 设置。

---

## 💾 持久化存储

Railway 免费计划支持持久化卷存储。

### 配置持久化卷

1. 在 Railway Dashboard 中打开项目
2. 点击 **Settings** → **Volumes**
3. 点击 **Add Volume**
4. 配置挂载路径：
   - Mount Path: `/app/logs`
   - Size: 1GB

重复操作添加数据目录：
- Mount Path: `/app/data`
- Size: 1GB

---

## 📊 监控和维护

### 查看资源使用

在 Railway Dashboard 中：
1. 点击项目
2. 查看 **Metrics** 标签页
3. 监控 CPU、内存、网络使用情况

### 查看部署历史

1. 点击 **Deployments** 标签页
2. 查看所有部署记录
3. 可以回滚到任意历史版本

### 自动重启策略

Railway 会在以下情况自动重启：
- 容器崩溃
- 健康检查失败
- 内存超限（OOM）

重启策略：`ON_FAILURE`，最多重试10次。

---

## 🔧 故障排查

### 部署失败

1. **查看构建日志**：
   - Deployments → 选择失败的部署
   - 查看 Build Logs

2. **常见问题**：
   - Dockerfile 语法错误
   - 依赖安装失败
   - 内存不足

### 运行时错误

1. **查看运行日志**：
   - Deployments → View Logs
   - 搜索错误关键字

2. **环境变量检查**：
   ```bash
   railway variables
   ```
   确认所有必需变量已设置

3. **重新部署**：
   ```bash
   railway up --detach
   ```

### 应用无响应

1. **检查容器状态**：
   - Dashboard → 查看容器是否运行中

2. **查看健康检查**：
   - Settings → Health Check
   - 确认健康检查配置正确

3. **手动重启**：
   ```bash
   railway restart
   ```

---

## 💡 最佳实践

### 1. 使用环境变量管理敏感信息

永远不要将 API_KEYS 提交到 Git：

```bash
# 在 Railway 中设置
railway variables set API_KEYS=88_xxx,88_yyy
```

### 2. 启用通知

在 Railway Dashboard 中配置：
- Settings → Notifications
- 启用部署失败通知
- 启用应用崩溃通知

### 3. 定期查看日志

```bash
# 每天查看一次日志
railway logs --tail 100

# 监控错误
railway logs | grep ERROR
```

### 4. 设置资源限制

Railway 会根据使用量自动扩展，但建议设置限制：
- Settings → Resources
- 设置内存和 CPU 限制

### 5. 使用生产环境变量

```bash
railway variables set NODE_ENV=production
railway variables set LOG_LEVEL=info
```

---

## 💰 费用说明

### 免费额度

- **$5/月** 免费额度
- 约 **500小时** 运行时间
- 持久化存储支持

### 计费方式

按使用量计费：
- **CPU**: $0.000463/vCPU 分钟
- **内存**: $0.000231/GB 分钟
- **存储**: 免费（合理使用）

对于 88code-reset-nodejs（轻量级后台任务）：
- 预计每月使用 **$2-3**
- 完全在免费额度内 ✅

---

## 📚 相关资源

- [Railway 官方文档](https://docs.railway.app/)
- [railway.toml 配置参考](https://docs.railway.app/deploy/config-as-code)
- [Railway CLI 文档](https://docs.railway.app/develop/cli)
- [项目配置文件](../railway.toml)
