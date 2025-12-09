#!/bin/bash

# 88code Reset Service - 一键部署脚本

set -e
set -o pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 项目信息
REPO="2ue/88code-reset-nodejs"
BRANCH="main"
DOCKER_IMAGE="huby11111/88code-reset-nodejs:latest"
CONTAINER_NAME="88code-reset"

# 工具函数
die() { echo -e "${RED}✗ $1${NC}" >&2; exit 1; }
info() { echo -e "${YELLOW}ℹ $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }

# 检查 curl
command -v curl >/dev/null 2>&1 || die "需要 curl，请安装: apt-get install curl"

# 下载文件
download() {
    local file=$1
    local url="https://raw.githubusercontent.com/${REPO}/${BRANCH}/${file}"

    if [ -f "$file" ]; then
        read -p "$(echo -e ${YELLOW}文件 $file 已存在，是否覆盖？[y/N]: ${NC})" ans
        [[ $ans =~ ^[Yy]$ ]] || { info "跳过 $file"; return 0; }
    fi

    curl -fsSL "$url" -o "$file" || die "下载失败: $file"
    success "下载: $file"
}

# 获取 API Keys
get_api_keys() {
    echo ""
    info "请输入 88code API Keys（多个用逗号分隔）"
    info "格式: 88_xxx,88_yyy 或单个 88_xxx"
    read -p "> " keys
    [ -z "$keys" ] && die "API Keys 不能为空"
    echo "$keys"
}

# 创建 .env
create_env() {
    local keys=$1
    [ -f ".env.example" ] || die ".env.example 不存在"

    # 安全地写入 API_KEYS（避免 shell 注入）
    grep -v '^API_KEYS=' .env.example > .env
    printf 'API_KEYS=%s\n' "$keys" >> .env

    success "配置文件 .env 创建完成"
}

# 准备环境
prepare_env() {
    download ".env.example"
    local keys
    keys=$(get_api_keys)
    create_env "$keys"
}

# 查看日志
view_logs() {
    echo ""
    read -p "$(echo -e ${YELLOW}是否查看日志？[Y/n]: ${NC})" ans
    [[ $ans =~ ^[Nn]$ ]] && return 0

    # 直接执行，不用 eval
    if [ -n "$COMPOSE_CMD" ]; then
        $COMPOSE_CMD logs -f
    else
        docker logs -f "$CONTAINER_NAME"
    fi
}

# Docker Compose 部署
deploy_compose() {
    local cmd=$1
    info "使用 $cmd 部署..."

    download "docker-compose.yml"
    prepare_env

    info "启动服务..."
    $cmd up -d

    success "服务启动成功"
    COMPOSE_CMD=$cmd view_logs
}

# Docker 部署
deploy_docker() {
    info "使用 docker 部署..."

    prepare_env

    info "拉取镜像..."
    docker pull "$DOCKER_IMAGE"

    info "清理旧容器..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true

    info "启动容器..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        --env-file .env \
        --restart unless-stopped \
        -v "$(pwd)/logs:/app/logs" \
        "$DOCKER_IMAGE"

    success "服务启动成功"
    view_logs
}

# 主函数
main() {
    echo "========================================"
    echo "  88code Reset Service - 一键部署"
    echo "========================================"
    echo ""

    # 检测部署方式（按优先级）
    if command -v docker-compose >/dev/null 2>&1; then
        deploy_compose "docker-compose"
    elif docker compose version >/dev/null 2>&1; then
        deploy_compose "docker compose"
    elif command -v docker >/dev/null 2>&1; then
        deploy_docker
    else
        die "未找到 Docker\n请安装: https://docs.docker.com/get-docker/"
    fi
}

main
