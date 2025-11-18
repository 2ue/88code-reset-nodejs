#!/bin/bash
#
# 88code 完整测试脚本
# 自动启动Mock服务器、配置测试环境、执行测试
#
# 使用方法:
#   ./test/run-test.sh [first|second|both|daemon]
#
# 参数:
#   first   - 只测试第一次检查点
#   second  - 只测试第二次检查点
#   both    - 测试两次检查点（默认）
#   daemon  - 启动守护进程模式（会持续运行）
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MOCK_SERVER="$SCRIPT_DIR/mock-api/server.mjs"
TEST_ENV="$SCRIPT_DIR/.env.test"
BACKUP_ENV="$PROJECT_ROOT/.env.backup"

# 从测试配置读取Mock端口
if [ -f "$TEST_ENV" ]; then
    MOCK_PORT=$(grep "^MOCK_API_PORT=" "$TEST_ENV" | cut -d'=' -f2)
    MOCK_PORT=${MOCK_PORT:-3888}  # 默认3888
else
    MOCK_PORT=3888
fi

# 测试模式（默认both）
TEST_MODE="${1:-both}"

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 清理测试环境...${NC}"

    # 停止Mock服务器
    if [ ! -z "$MOCK_PID" ]; then
        echo -e "${BLUE}   停止Mock服务器 (PID: $MOCK_PID)...${NC}"
        kill $MOCK_PID 2>/dev/null || true
        wait $MOCK_PID 2>/dev/null || true
    fi

    # 恢复原始.env
    if [ -f "$BACKUP_ENV" ]; then
        echo -e "${BLUE}   恢复原始配置...${NC}"
        mv "$BACKUP_ENV" "$PROJECT_ROOT/.env"
    fi

    echo -e "${GREEN}✅ 清理完成${NC}"
}

# 注册清理函数
trap cleanup EXIT INT TERM

# 打印标题
echo ""
echo -e "${BLUE}================================================================================${NC}"
echo -e "${BLUE}🧪 88code 测试框架${NC}"
echo -e "${BLUE}================================================================================${NC}"
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未找到Node.js，请先安装Node.js${NC}"
    exit 1
fi

# 检查测试数据文件
TEST_DATA="$SCRIPT_DIR/mock-api/test-data.json"
if [ ! -f "$TEST_DATA" ]; then
    echo -e "${RED}❌ 未找到测试数据文件: $TEST_DATA${NC}"
    exit 1
fi

# 检查端口占用
check_port_and_cleanup() {
    local PORT=$1
    local PID=$(lsof -ti :$PORT 2>/dev/null)

    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}⚠️  端口 $PORT 已被占用 (PID: $PID)${NC}"
        echo -e "${BLUE}   正在停止旧进程...${NC}"
        kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
        sleep 1
        echo -e "${GREEN}✅ 已清理端口 $PORT${NC}"
    fi
}

# 1. 检查并清理端口
check_port_and_cleanup $MOCK_PORT

# 2. 启动Mock服务器
echo -e "${BLUE}📡 启动Mock API服务器 (端口: $MOCK_PORT)...${NC}"
MOCK_API_PORT=$MOCK_PORT node "$MOCK_SERVER" > /dev/null 2>&1 &
MOCK_PID=$!

# 等待Mock服务器启动
sleep 2

# 检查Mock服务器是否启动成功
if ! kill -0 $MOCK_PID 2>/dev/null; then
    echo -e "${RED}❌ Mock服务器启动失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Mock服务器已启动 (PID: $MOCK_PID, PORT: $MOCK_PORT)${NC}"

# 2. 备份并替换.env
echo -e "${BLUE}📝 配置测试环境...${NC}"

if [ -f "$PROJECT_ROOT/.env" ]; then
    cp "$PROJECT_ROOT/.env" "$BACKUP_ENV"
    echo -e "${GREEN}✅ 已备份原始配置${NC}"
fi

cp "$TEST_ENV" "$PROJECT_ROOT/.env"
echo -e "${GREEN}✅ 已应用测试配置${NC}"

# 3. 创建通知输出目录
mkdir -p "$PROJECT_ROOT/notifications"

# 4. 执行测试
echo ""
echo -e "${BLUE}================================================================================${NC}"
echo -e "${BLUE}🚀 开始测试${NC}"
echo -e "${BLUE}================================================================================${NC}"
echo ""

cd "$PROJECT_ROOT"

case "$TEST_MODE" in
    first)
        echo -e "${YELLOW}📍 测试第一次检查点...${NC}"
        npm run reset:first
        ;;

    second)
        echo -e "${YELLOW}📍 测试第二次检查点...${NC}"
        npm run reset:second
        ;;

    daemon)
        echo -e "${YELLOW}🔄 启动守护进程模式...${NC}"
        echo -e "${YELLOW}   按 Ctrl+C 停止${NC}"
        npm start
        ;;

    both|*)
        echo -e "${YELLOW}📍 测试第一次检查点...${NC}"
        npm run reset:first

        echo ""
        echo -e "${YELLOW}等待 3 秒...${NC}"
        sleep 3

        echo ""
        echo -e "${YELLOW}📍 测试第二次检查点...${NC}"
        npm run reset:second
        ;;
esac

# 5. 显示结果
echo ""
echo -e "${BLUE}================================================================================${NC}"
echo -e "${BLUE}📊 测试完成${NC}"
echo -e "${BLUE}================================================================================${NC}"
echo ""

# 显示通知文件
NOTIFICATION_DIR="$PROJECT_ROOT/notifications"
if [ -d "$NOTIFICATION_DIR" ] && [ "$(ls -A $NOTIFICATION_DIR)" ]; then
    echo -e "${GREEN}📝 通知文件:${NC}"
    ls -lh "$NOTIFICATION_DIR"
    echo ""

    # 显示最新的通知内容
    LATEST_NOTIFICATION=$(ls -t "$NOTIFICATION_DIR"/notification-*.txt 2>/dev/null | head -1)
    if [ ! -z "$LATEST_NOTIFICATION" ]; then
        echo -e "${GREEN}📄 最新通知内容:${NC}"
        echo -e "${BLUE}================================================================================${NC}"
        cat "$LATEST_NOTIFICATION"
        echo -e "${BLUE}================================================================================${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  未生成通知文件${NC}"
fi

echo ""
echo -e "${GREEN}✅ 测试完成！${NC}"
echo ""
