#!/bin/bash

# 88code-reset-nodejs 发布脚本
# 用于创建版本标签并触发 GitHub Actions 自动发布

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在 git 仓库中
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "当前目录不是 git 仓库"
        exit 1
    fi
}

# 检查是否有未提交的更改
check_git_status() {
    if [[ -n $(git status --porcelain) ]]; then
        print_error "存在未提交的更改，请先提交所有更改"
        git status --short
        exit 1
    fi
}

# 检查当前分支
check_current_branch() {
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "main" ]]; then
        print_warning "当前不在 main 分支，当前分支: $current_branch"
        read -p "是否继续发布? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "发布已取消"
            exit 0
        fi
    fi
}

# 获取当前版本
get_current_version() {
    if [[ -f "package.json" ]]; then
        node -p "require('./package.json').version"
    else
        print_error "package.json 文件不存在"
        exit 1
    fi
}

# 验证版本格式
validate_version() {
    local version=$1
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "版本格式无效，请使用 x.y.z 格式"
        exit 1
    fi
}

# 检查版本是否已存在
check_tag_exists() {
    local version=$1
    local tag="v$version"
    if git rev-parse "$tag" >/dev/null 2>&1; then
        print_error "标签 $tag 已存在"
        exit 1
    fi
}

# 确认发布
confirm_release() {
    local version=$1
    local current_version=$2

    echo
    print_info "发布信息："
    echo "  当前版本: $current_version"
    echo "  发布版本: $version"
    echo "  标签: v$version"
    echo

    read -p "确认发布? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "发布已取消"
        exit 0
    fi
}

# 更新 package.json 版本
update_package_version() {
    local version=$1
    print_info "更新 package.json 版本到 $version"
    npm version $version --no-git-tag-version
}

# 创建提交和标签
create_commit_and_tag() {
    local version=$1
    local tag="v$version"

    print_info "创建版本提交"
    git add package.json
    git commit -m "chore(release): bump version to $version"

    print_info "创建标签 $tag"
    git tag -a "$tag" -m "Release $tag"

    print_info "推送到远程仓库"
    git push origin main
    git push origin "$tag"
}

# 显示发布后信息
show_post_release_info() {
    local version=$1
    local tag="v$version"

    echo
    print_success "发布成功！"
    echo
    print_info "后续步骤："
    echo "1. GitHub Actions 将自动构建并推送 Docker 镜像"
    echo "2. 自动创建 GitHub Release: https://github.com/$(git config --get remote.origin.url | sed 's/.*:\/\/github.com\///; s/\.git$//')/releases/tag/$tag"
    echo "3. 可以通过以下命令查看 Actions 状态:"
    echo "   gh run list --limit 1"
    echo
    print_info "Docker 镜像将在几分钟后可用："
    echo "  docker pull your-dockerhub-username/88code-reset-nodejs:$version"
    echo "  docker pull ghcr.io/$(git config --get remote.origin.url | sed 's/.*:\/\/github.com\///; s/\.git$//'):$version"
}

# 主函数
main() {
    echo "88code-reset-nodejs 发布脚本"
    echo "================================"

    # 检查环境
    check_git_repo
    check_git_status
    check_current_branch

    # 获取版本信息
    local current_version=$(get_current_version)
    print_info "当前版本: $current_version"

    # 解析命令行参数
    local version=""
    local patch=false
    local minor=false
    local major=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --version|-v)
                version="$2"
                shift 2
                ;;
            --patch|-p)
                patch=true
                shift
                ;;
            --minor|-m)
                minor=true
                shift
                ;;
            --major|-M)
                major=true
                shift
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo
                echo "选项:"
                echo "  --version, -v VERSION    指定版本号 (x.y.z)"
                echo "  --patch, -p              补丁版本升级 (x.y.z+1)"
                echo "  --minor, -m              次要版本升级 (x.y+1.0)"
                echo "  --major, -M              主要版本升级 (x+1.0.0)"
                echo "  --help, -h               显示此帮助信息"
                echo
                echo "示例:"
                echo "  $0 --version 1.2.3"
                echo "  $0 --patch"
                echo "  $0 --minor"
                exit 0
                ;;
            *)
                print_error "未知参数: $1"
                echo "使用 --help 查看帮助信息"
                exit 1
                ;;
        esac
    done

    # 确定新版本号
    if [[ -n "$version" ]]; then
        validate_version "$version"
        check_tag_exists "$version"
    elif [[ "$patch" == true ]]; then
        version=$(node -e "
            const v = '$current_version'.split('.');
            v[2] = parseInt(v[2]) + 1;
            console.log(v.join('.'));
        ")
        check_tag_exists "$version"
    elif [[ "$minor" == true ]]; then
        version=$(node -e "
            const v = '$current_version'.split('.');
            v[1] = parseInt(v[1]) + 1;
            v[2] = 0;
            console.log(v.join('.'));
        ")
        check_tag_exists "$version"
    elif [[ "$major" == true ]]; then
        version=$(node -e "
            const v = '$current_version'.split('.');
            v[0] = parseInt(v[0]) + 1;
            v[1] = 0;
            v[2] = 0;
            console.log(v.join('.'));
        ")
        check_tag_exists "$version"
    else
        print_error "请指定版本升级方式"
        echo "使用 --help 查看帮助信息"
        exit 1
    fi

    # 确认发布
    confirm_release "$version" "$current_version"

    # 执行发布流程
    update_package_version "$version"
    create_commit_and_tag "$version"

    # 显示发布后信息
    show_post_release_info "$version"
}

# 运行主函数
main "$@"