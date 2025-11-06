# 发布指南

本项目使用 GitHub Actions 自动化 Docker 镜像构建和发布流程。

## 前置准备

### 1. 配置 Docker Hub Token

在 GitHub 仓库设置中添加 Secret：

1. 访问 [Docker Hub Access Tokens](https://hub.docker.com/settings/security)
2. 创建新的 Access Token
3. 在 GitHub 仓库中：Settings → Secrets and variables → Actions → New repository secret
4. 添加 Secret：
   - Name: `DOCKERHUB_TOKEN`
   - Value: 你的 Docker Hub Access Token

### 2. 确保 GitHub Token 权限

GitHub Actions 默认的 `GITHUB_TOKEN` 已经配置好，具有以下权限：
- `contents: write` - 创建 Release
- `packages: write` - 推送到 GHCR

## 发布流程

### 方式一：使用发布脚本（推荐）

项目提供了自动化发布脚本 `scripts/release.sh`：

```bash
# 补丁版本升级 (1.0.0 → 1.0.1)
./scripts/release.sh --patch

# 次要版本升级 (1.0.0 → 1.1.0)
./scripts/release.sh --minor

# 主要版本升级 (1.0.0 → 2.0.0)
./scripts/release.sh --major

# 指定具体版本号
./scripts/release.sh --version 1.2.3
```

脚本会自动执行：
1. 检查 git 仓库状态
2. 更新 package.json 版本号
3. 创建版本提交
4. 创建并推送版本标签
5. 触发 GitHub Actions 自动构建

### 方式二：手动发布

```bash
# 1. 更新版本号
npm version patch  # 或 minor / major

# 2. 推送代码和标签
git push origin main
git push origin --tags
```

## 发布流程说明

当推送版本标签（格式：`v*.*.*`）时，GitHub Actions 会自动：

1. **检出代码** - 获取最新代码
2. **设置 Docker Buildx** - 支持多平台构建
3. **登录镜像仓库**
   - Docker Hub (使用 `DOCKERHUB_TOKEN`)
   - GitHub Container Registry (使用 `GITHUB_TOKEN`)
4. **构建镜像** - 支持 linux/amd64 和 linux/arm64 两个平台
5. **推送镜像** - 并行推送到两个仓库，生成多个标签：
   - `x.y.z` - 完整版本号
   - `x.y` - 主次版本号
   - `x` - 主版本号
   - `latest` - 最新版本（仅主分支）
6. **创建 GitHub Release** - 自动生成发布说明

## 镜像仓库

发布后，Docker 镜像会同时推送到两个仓库：

### Docker Hub
- 仓库地址：`docker.io/huby11111/88code-reset-nodejs`
- 访问地址：https://hub.docker.com/r/huby11111/88code-reset-nodejs

### GitHub Container Registry (GHCR)
- 仓库地址：`ghcr.io/<你的GitHub用户名>/88code-reset-nodejs`
- 访问地址：https://github.com/<你的GitHub用户名>/88code-reset-nodejs/pkgs/container/88code-reset-nodejs

## 使用发布的镜像

```bash
# 拉取最新版本
docker pull huby11111/88code-reset-nodejs:latest

# 拉取指定版本
docker pull huby11111/88code-reset-nodejs:1.0.0

# 从 GHCR 拉取
docker pull ghcr.io/<你的GitHub用户名>/88code-reset-nodejs:latest
```

## 版本号规范

本项目使用语义化版本（Semantic Versioning）：

- **主版本号（Major）**: 不兼容的 API 变更
- **次版本号（Minor）**: 向后兼容的功能新增
- **补丁版本号（Patch）**: 向后兼容的问题修复

格式：`vX.Y.Z`（例如：`v1.2.3`）

## 查看发布状态

### GitHub Actions
访问：https://github.com/<你的GitHub用户名>/88code-reset-nodejs/actions

或使用 GitHub CLI：
```bash
gh run list --limit 5
gh run view <run-id>
```

### GitHub Releases
访问：https://github.com/<你的GitHub用户名>/88code-reset-nodejs/releases

## 故障排查

### 1. Docker Hub 登录失败
- 检查 `DOCKERHUB_TOKEN` Secret 是否正确配置
- 确认 Token 未过期且有推送权限

### 2. GHCR 推送失败
- 检查仓库 Actions 权限：Settings → Actions → General → Workflow permissions
- 确保选择了 "Read and write permissions"

### 3. 多平台构建失败
- 检查 Dockerfile 是否支持多架构
- 查看构建日志中的错误信息

### 4. Release 创建失败
- 检查仓库 Actions 权限中的 `contents: write` 权限
- 确认标签格式正确（`v*.*.*`）

## 回滚版本

如果需要回滚到之前的版本：

```bash
# 拉取旧版本镜像
docker pull huby11111/88code-reset-nodejs:1.0.0

# 或编辑 docker-compose.yml，指定版本
image: huby11111/88code-reset-nodejs:1.0.0
```

## 最佳实践

1. **发布前测试** - 在本地或测试环境充分测试
2. **查看变更** - 确认所有更改都已提交
3. **编写 Release Notes** - GitHub Release 支持手动编辑发布说明
4. **遵循语义化版本** - 正确选择版本号升级类型
5. **保持标签同步** - 确保 git 标签和 package.json 版本一致

## 参考资源

- [Semantic Versioning](https://semver.org/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [GitHub Release Action](https://github.com/softprops/action-gh-release)