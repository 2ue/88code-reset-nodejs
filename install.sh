#!/bin/bash

# 88code Reset Service - 一键部署脚本

set -e  # 遇到错误立即退出
set -o pipefail  # 管道命令失败时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 打印函数
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ $1${NC}"; }

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 下载文件
download_file() {
    local path=$1  # 例如：2ue/88code-reset-nodejs/main/docker-compose.yml
    local file=$2

    if [ -f "$file" ]; then
        read -p "$(echo -e ${YELLOW}文件 $file 已存在，是否覆盖？[y/N]: ${NC})" overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_info "跳过下载 $file"
            return 0
        fi
    fi

    local url="https://raw.githubusercontent.com/${path}"

    if command_exists curl; then
        curl -fsSL "$url" -o "$file"
    elif command_exists wget; then
        wget -q "$url" -O "$file"
    else
        print_error "需要 curl 或 wget 来下载文件"
        exit 1
    fi

    print_success "下载完成: $file"
}

# 输入 API Keys
input_api_keys() {
    echo ""
    print_info "请输入 88code API Keys（多个用逗号分隔）："
    print_info "格式示例: 88_xxx,88_yyy 或单个 88_xxx"
    read -p "> " api_keys

    # 验证输入
    if [ -z "$api_keys" ]; then
        print_error "API Keys 不能为空"
        exit 1
    fi

    echo "$api_keys"
}

# 创建 .env 文件
create_env_file() {
    local api_keys=$1

    if [ ! -f ".env.example" ]; then
        print_error ".env.example 文件不存在"
        exit 1
    fi

    # 复制模板并替换 API_KEYS（避免 sed 平台差异和注入风险）
    grep -v '^API_KEYS=' .env.example > .env
    echo "API_KEYS=${api_keys}" >> .env

    print_success "配置文件 .env 创建完成"
}

# 准备环境文件
prepare_env_file() {
    download_file "2ue/88code-reset-nodejs/main/.env.example" ".env.example"
    local api_keys
    api_keys=$(input_api_keys)
    create_env_file "$api_keys"
}

# 询问是否查看日志
ask_view_logs() {
    local log_cmd=$1
    echo ""
    read -p "$(echo -e ${YELLOW}是否查看日志？[Y/n]: ${NC})" view_logs
    if [[ ! $view_logs =~ ^[Nn]$ ]]; then
        eval "$log_cmd"
    fi
}

# 使用 docker-compose 部署
deploy_with_compose() {
    local compose_cmd=$1

    print_info "使用 ${compose_cmd} 部署..."

    # 下载文件
    download_file "2ue/88code-reset-nodejs/main/docker-compose.yml" "docker-compose.yml"
    prepare_env_file

    # 启动服务
    print_info "启动服务..."
    ${compose_cmd} up -d

    print_success "服务启动成功！"
    ask_view_logs "${compose_cmd} logs -f"
}

# 使用 docker 部署
deploy_with_docker() {
    print_info "使用 docker 部署..."

    # 准备环境文件
    prepare_env_file

    # 拉取镜像
    print_info "拉取镜像..."
    docker pull huby11111/88code-reset-nodejs:latest

    # 停止并删除旧容器（如果存在）
    print_info "清理旧容器..."
    docker stop 88code-reset 2>/dev/null || true
    docker rm 88code-reset 2>/dev/null || true

    # 启动容器
    print_info "启动容器..."
    docker run -d \
        --name 88code-reset \
        --env-file .env \
        --restart unless-stopped \
        -v "$(pwd)/logs:/app/logs" \
        huby11111/88code-reset-nodejs:latest

    print_success "服务启动成功！"
    ask_view_logs "docker logs -f 88code-reset"
}

# 主函数
main() {
    echo "========================================"
    echo "  88code Reset Service - 一键部署脚本"
    echo "========================================"
    echo ""

    # 检查 docker-compose（优先）
    if command_exists docker-compose; then
        deploy_with_compose "docker-compose"
        return
    fi

    # 检查 docker compose（新版本）
    if docker compose version >/dev/null 2>&1; then
        deploy_with_compose "docker compose"
        return
    fi

    # 检查 docker
    if command_exists docker; then
        deploy_with_docker
        return
    fi

    # 都不存在
    print_error "未找到 Docker 或 Docker Compose"
    echo ""
    print_info "请先安装 Docker："
    echo "  官方文档: https://docs.docker.com/get-docker/"
    echo ""
    exit 1
}

# 执行
main
