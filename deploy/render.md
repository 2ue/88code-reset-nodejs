# Render 部署指南

Render 提供 750小时/月免费额度，支持 Blueprint 配置文件自动化部署。

---

## ✨ 特点

- ✅ 750小时/月免费额度
- ✅ 支持 Blueprint 配置文件
- ✅ 自动检测 Dockerfile
- ✅ GitHub 自动部署
- ⚠️ 持久化存储需付费

---

## 🚀 部署步骤

### 方式1: Blueprint 自动部署（推荐）

项目已包含 `render.yaml` 配置文件，可以一键部署。

#### 1. 注册账号

访问 https://render.com 注册账号

#### 2. 使用 Blueprint

1. 在 Render Dashboard 点击 **"New +"**
2. 选择 **"Blueprint"**
3. 连接你的 GitHub 仓库
4. 选择 `88code-reset-nodejs` 仓库
5. Render 自动读取 `render.yaml` 并创建服务

#### 3. 配置环境变量

Blueprint 会自动创建服务，但敏感环境变量需要手动设置：

1. 点击创建的服务
2. 进入 **Environment** 标签页
3. 添加以下变量：

```env
API_KEYS=88_your_key_here,88_another_key_here
API_BASE_URL=https://api.88code.com
```

#### 4. 重新部署

环境变量设置后，点击 **Manual Deploy** → **Deploy latest commit**

---

### 方式2: 手动创建服务

如果不使用 Blueprint，可以手动创建：

#### 1. 创建新服务

1. 点击 **"New +"** → **"Background Worker"**
2. 连接 GitHub 仓库
3. 选择 `88code-reset-nodejs` 仓库

#### 2. 配置服务

**基本配置**：
- **Name**: `88code-reset-nodejs`
- **Runtime**: `Docker`
- **Branch**: `main`
- **Dockerfile Path**: `./Dockerfile`

**环境变量**：
添加必需的环境变量（在 Environment 标签页）：

```env
API_KEYS=88_your_key_here,88_another_key_here
API_BASE_URL=https://api.88code.com
NODE_ENV=production
TZ=Asia/Shanghai
```

#### 3. 部署

点击 **"Create Background Worker"**，Render 会：
- 自动克隆代码
- 使用 Dockerfile 构建镜像
- 启动容器
- 监控健康状态

---

## ⚙️ render.yaml 配置说明

项目已包含 `render.yaml` 配置文件：

```yaml
services:
  - type: worker
    name: 88code-reset-nodejs
    runtime: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .

    # 环境变量（需要在 Render Dashboard 中配置敏感信息）
    envVars:
      - key: NODE_ENV
        value: production
      - key: TZ
        value: Asia/Shanghai
      - key: API_BASE_URL
        sync: false  # 需要手动在 Dashboard 中设置
      - key: API_KEYS
        sync: false  # 需要手动在 Dashboard 中设置（多个key用逗号分隔）

    # 自动部署
    autoDeploy: true

    # 分支部署
    branch: main
```

**配置说明**：
- `type: worker`: 后台任务类型（不对外提供HTTP服务）
- `runtime: docker`: 使用 Docker 运行时
- `sync: false`: 敏感信息不从文件同步，需手动设置

---

## 💾 持久化存储

⚠️ **注意**: Render 的持久化存储需要付费计划。

### 配置持久化磁盘（付费）

如果需要持久化日志和数据，在 `render.yaml` 中取消注释：

```yaml
disk:
  name: data
  mountPath: /app/data
  sizeGB: 1
```

或在 Dashboard 中手动添加：
1. 打开服务设置
2. 进入 **Disks** 标签页
3. 点击 **Add Disk**
4. 配置挂载路径和大小

---

## 📊 监控和维护

### 查看日志

1. 在 Render Dashboard 中打开服务
2. 点击 **Logs** 标签页
3. 查看实时日志输出

或使用搜索功能：
- 搜索特定日期
- 过滤错误日志
- 导出日志文件

### 查看部署历史

1. 点击 **Events** 标签页
2. 查看所有部署、重启、扩容事件
3. 可以回滚到任意历史版本

### 手动重启

1. 点击 **Manual Deploy** → **Clear build cache & deploy**
2. 或直接点击 **Restart Service**

---

## 🔧 故障排查

### 部署失败

**查看构建日志**：
1. Logs 标签页
2. 选择 **Build Logs**
3. 查找错误信息

**常见问题**：
- Dockerfile 路径错误
- 依赖安装失败
- 环境变量缺失

**解决方法**：
```bash
# 确认 Dockerfile 路径
./Dockerfile  # 应该在项目根目录

# 确认环境变量
在 Environment 标签页检查 API_KEYS 是否已设置
```

### 运行时错误

**查看运行日志**：
1. Logs 标签页
2. 查看 **Service Logs**
3. 搜索 ERROR 关键字

**检查环境变量**：
```bash
# 在 Environment 标签页确认
API_KEYS - 已设置 ✅
API_BASE_URL - 已设置 ✅
```

### 应用频繁重启

**原因**：
- 内存不足（OOM）
- 健康检查失败
- 应用崩溃

**解决方法**：
1. 升级到更大的实例类型
2. 检查代码是否有内存泄漏
3. 查看详细错误日志

---

## 💡 最佳实践

### 1. 使用 Blueprint

使用 `render.yaml` 可以：
- 版本控制配置
- 快速重建环境
- 团队协作方便

### 2. 环境变量管理

**敏感信息**：
```yaml
# render.yaml
envVars:
  - key: API_KEYS
    sync: false  # 不从文件同步，手动设置
```

**非敏感信息**：
```yaml
# render.yaml
envVars:
  - key: NODE_ENV
    value: production  # 直接写在配置文件
```

### 3. 自动部署配置

```yaml
autoDeploy: true  # 推送代码自动部署
branch: main      # 监控的分支
```

### 4. 通知设置

在 Settings → Notifications 中配置：
- 部署成功/失败通知
- 服务停机通知
- 发送到邮箱或 Slack

### 5. 监控日志

定期检查日志：
```
Logs → Filter by level → ERROR
```

---

## 💰 费用说明

### 免费额度

- **750小时/月** 免费运行时间
- 适合轻量级后台任务
- 自动休眠机制（Worker 不适用）

### 计费方式

**Background Worker 计费**：
- Starter: $7/月（512MB 内存）
- Standard: $25/月（2GB 内存）

**持久化存储**：
- 1GB SSD: $1/月

### 免费计划说明

对于 88code-reset-nodejs：
- 预计每月使用 **720小时**（24×30天）
- 完全在 750小时免费额度内 ✅
- 无需持久化存储（日志可输出到控制台）

---

## 🎯 优化建议

### 1. 禁用持久化存储

如果不需要保存历史数据，可以：
- 注释掉 `render.yaml` 中的 `disk` 配置
- 日志仅输出到控制台
- 降低成本

### 2. 使用环境变量控制日志

```env
LOG_LEVEL=info
LOG_TO_FILE=false  # 不写文件，仅控制台
```

### 3. 监控资源使用

在 Dashboard 中监控：
- CPU 使用率
- 内存使用率
- 重启次数

如果资源不足，考虑升级实例。

---

## 📚 相关资源

- [Render 官方文档](https://render.com/docs)
- [Blueprint 配置参考](https://render.com/docs/blueprint-spec)
- [Background Worker 文档](https://render.com/docs/background-workers)
- [项目配置文件](../render.yaml)
