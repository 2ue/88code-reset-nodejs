# Fly.io 部署指南

> **官方网站**: [fly.io](https://fly.io) | **官方文档**: [fly.io/docs](https://fly.io/docs) | **CLI 文档**: [fly.io/docs/flyctl](https://fly.io/docs/flyctl) | **定价**: [fly.io/docs/about/pricing](https://fly.io/docs/about/pricing)

Fly.io 提供全球分布式部署，支持多区域和持久化卷存储。

---

## ✨ 特点

- ✅ 3个免费 VM + 160GB 流量/月
- ✅ 全球多区域部署
- ✅ 持久化卷存储（免费）
- ✅ 自动扩展和负载均衡
- ⚠️ 需要命令行操作

---

## 📦 准备工作

### 安装 Fly CLI

#### macOS / Linux

```bash
curl -L https://fly.io/install.sh | sh
```

#### Windows (PowerShell)

```bash
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

#### 验证安装

```bash
flyctl version
```

---

## 🚀 部署步骤

### 1. 登录 Fly.io

```bash
flyctl auth login
```

浏览器会自动打开，完成登录授权。

### 2. 初始化项目

```bash
# 在项目目录下运行
cd 88code-reset-nodejs

# 初始化应用
flyctl launch
```

#### 交互式配置

```
? Choose an app name: 88code-reset-nodejs (或自定义)
? Choose a region: hkg (香港) / nrt (东京) / sin (新加坡)
? Would you like to set up a PostgreSQL database? No
? Would you like to set up a Redis database? No
? Would you like to deploy now? Yes
```

项目已包含 `fly.toml` 配置文件，Fly 会自动使用。

### 3. 设置环境变量

```bash
# 设置 API 密钥（多个用逗号分隔）
flyctl secrets set API_KEYS=88_xxx,88_yyy

# 设置 API 地址
flyctl secrets set API_BASE_URL=https://api.88code.com

# 批量设置（可选）
flyctl secrets set \
  NODE_ENV=production \
  TZ=Asia/Shanghai \
  FIRST_RESET_TIME=18:55 \
  SECOND_RESET_TIME=23:56
```

### 4. 部署应用

```bash
# 部署到 Fly.io
flyctl deploy

# 查看部署状态
flyctl status

# 查看应用信息
flyctl info
```

### 5. 查看日志

```bash
# 实时查看日志
flyctl logs -f

# 查看历史日志
flyctl logs

# 查看最后100行
flyctl logs --tail 100
```

---

## ⚙️ fly.toml 配置说明

项目已包含 `fly.toml` 配置文件：

```toml
app = "88code-reset-nodejs"
primary_region = "hkg"

[build]
  dockerfile = "Dockerfile"

[vm]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1

[[vm]]
  size = "shared-cpu-1x"

# 持久化卷挂载（可选）
# [[mounts]]
#   source = "data_volume"
#   destination = "/app/data"
#   initial_size = "1gb"

# [[mounts]]
#   source = "logs_volume"
#   destination = "/app/logs"
#   initial_size = "1gb"
```

**配置说明**：
- `primary_region`: 主要部署区域（hkg=香港）
- `memory`: 内存限制（256MB，适合轻量级应用）
- `cpu_kind`: CPU 类型（shared=共享CPU，免费）
- `dockerfile`: 使用 Dockerfile 构建

---

## 💾 持久化存储

### 创建持久化卷

```bash
# 创建数据卷（1GB）
flyctl volumes create data_volume --size 1 --region hkg

# 创建日志卷（1GB）
flyctl volumes create logs_volume --size 1 --region hkg

# 查看已创建的卷
flyctl volumes list
```

### 配置挂载

在 `fly.toml` 中取消注释 `[[mounts]]` 部分：

```toml
[[mounts]]
  source = "data_volume"
  destination = "/app/data"

[[mounts]]
  source = "logs_volume"
  destination = "/app/logs"
```

### 重新部署

```bash
flyctl deploy
```

---

## 📊 监控和维护

### 查看应用状态

```bash
# 应用详情
flyctl info

# 实例状态
flyctl status

# 资源使用
flyctl vm status
```

### 查看秘密变量

```bash
# 列出所有秘密（不显示值）
flyctl secrets list

# 删除秘密
flyctl secrets unset API_KEY
```

### 扩展应用

```bash
# 扩展实例数量
flyctl scale count 1

# 调整内存大小
flyctl scale memory 512

# 查看当前配置
flyctl scale show
```

### 暂停和恢复

```bash
# 暂停应用（停止计费）
flyctl suspend

# 恢复应用
flyctl resume
```

---

## 🛠️ 常用命令

### 应用管理

```bash
# 查看所有应用
flyctl apps list

# 打开应用 Dashboard
flyctl dashboard

# 删除应用
flyctl apps destroy <app-name>
```

### 部署管理

```bash
# 重新部署
flyctl deploy

# 回滚到上一个版本
flyctl releases rollback

# 查看部署历史
flyctl releases
```

### SSH 连接

```bash
# 连接到容器
flyctl ssh console

# 在容器中执行命令
flyctl ssh console -C "ls -la /app"
```

### 调试

```bash
# 查看实时日志
flyctl logs -f

# 查看错误日志
flyctl logs | grep ERROR

# 检查健康状态
flyctl checks list
```

---

## 🔧 故障排查

### 部署失败

**查看构建日志**：
```bash
flyctl logs --tail 200
```

**常见问题**：
- Dockerfile 构建错误
- 依赖安装失败
- 内存不足

**解决方法**：
```bash
# 增加内存
flyctl scale memory 512

# 清理缓存重新构建
flyctl deploy --no-cache
```

### 应用崩溃

**查看崩溃日志**：
```bash
flyctl logs --tail 100 | grep -i error
```

**检查环境变量**：
```bash
# 确认秘密变量已设置
flyctl secrets list

# 重新设置
flyctl secrets set API_KEYS=88_xxx,88_yyy
```

### 无法连接

**检查应用状态**：
```bash
flyctl status
flyctl checks list
```

**重启应用**：
```bash
flyctl apps restart <app-name>
```

### 持久化卷问题

**检查卷状态**：
```bash
flyctl volumes list
flyctl volumes show <volume-id>
```

**创建新卷**：
```bash
flyctl volumes create data_volume --size 1 --region hkg
```

---

## 💡 最佳实践

### 1. 选择合适的区域

对于中国用户，推荐：
- `hkg` - 香港（最快）
- `nrt` - 东京
- `sin` - 新加坡

```bash
# 查看所有可用区域
flyctl platform regions

# 添加区域
flyctl regions add hkg nrt
```

### 2. 配置自动扩展

```toml
# fly.toml
[[services]]
  [[services.concurrency]]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"
    grace_period = "10s"
```

### 3. 监控资源使用

```bash
# 定期检查
flyctl vm status
flyctl status

# 调整资源
flyctl scale memory 512  # 如果内存不足
```

### 4. 使用健康检查

Dockerfile 中已配置健康检查：
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "process.exit(0)"
```

### 5. 定期查看日志

```bash
# 每天检查一次
flyctl logs --tail 100

# 监控错误
flyctl logs -f | grep ERROR
```

---

## 💰 费用说明

### 免费额度

- **3个 shared-cpu-1x VM**（256MB 内存）
- **160GB 出站流量/月**
- **3GB 持久化卷存储**

### 计费方式

超出免费额度后：
- **Shared CPU**: $0.0000008/秒（约 $2.07/月）
- **专用 CPU**: $0.00000278/秒（约 $7.20/月）
- **内存**: $0.0000002/MB/秒
- **持久化卷**: $0.15/GB/月

### 成本预估

对于 88code-reset-nodejs（256MB，24/7运行）：
- 单个实例：**完全免费** ✅
- 数据卷（1GB×2）：**$0.30/月**
- 总计：**~$0.30/月**

---

## 🎯 优化建议

### 1. 最小化内存使用

```toml
# fly.toml
[vm]
  memory = "256mb"  # 对于轻量级应用足够
```

### 2. 使用持久化卷

```bash
# 创建合适大小的卷
flyctl volumes create data_volume --size 1 --region hkg
```

### 3. 单区域部署

如果不需要多区域，使用单个区域降低成本：
```bash
flyctl regions set hkg
```

### 4. 定期清理日志

```bash
# 在容器中定期清理旧日志
flyctl ssh console -C "find /app/logs -mtime +30 -delete"
```

---

## 📚 相关资源

- [Fly.io 官方文档](https://fly.io/docs/)
- [fly.toml 配置参考](https://fly.io/docs/reference/configuration/)
- [Fly CLI 文档](https://fly.io/docs/flyctl/)
- [定价说明](https://fly.io/docs/about/pricing/)
- [项目配置文件](../fly.toml)
