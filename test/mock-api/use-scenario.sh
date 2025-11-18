#!/bin/bash
#
# 场景切换工具
# 快速切换不同的测试场景
#
# 使用方法:
#   ./test/mock-api/use-scenario.sh [场景名称]
#   ./test/mock-api/use-scenario.sh list  # 列出所有可用场景
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"
TARGET_FILE="$SCRIPT_DIR/test-data.json"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 列出所有场景
list_scenarios() {
    echo ""
    echo -e "${BLUE}📋 可用的测试场景：${NC}"
    echo ""

    if [ ! -d "$SCENARIOS_DIR" ]; then
        echo -e "${RED}❌ 场景目录不存在: $SCENARIOS_DIR${NC}"
        exit 1
    fi

    local index=1
    for scenario_file in "$SCENARIOS_DIR"/scenario-*.json; do
        if [ -f "$scenario_file" ]; then
            local scenario_name=$(basename "$scenario_file" .json | sed 's/scenario-//')
            local desc=$(get_scenario_description "$scenario_name")
            echo -e "${GREEN}${index}. ${scenario_name}${NC}"
            echo -e "   ${desc}"
            echo ""
            ((index++))
        fi
    done

    echo -e "${YELLOW}💡 使用方法:${NC}"
    echo "   ./test/mock-api/use-scenario.sh <场景名称>"
    echo ""
}

# 获取场景描述
get_scenario_description() {
    local scenario=$1
    case "$scenario" in
        "resetTimes-0")
            echo "resetTimes=0 - 已用完重置次数，两次检查点都应跳过"
            ;;
        "resetTimes-1")
            echo "resetTimes=1 - 只能第二次重置，第一次应跳过"
            ;;
        "resetTimes-2")
            echo "resetTimes=2 - 两次都可以重置，第一次重置后第二次应跳过"
            ;;
        "cooldown")
            echo "冷却期内 - lastCreditReset在5小时内，应被跳过"
            ;;
        "mixed")
            echo "混合场景 - 包含resetTimes=0/1/2和PAYGO，完整测试"
            ;;
        *)
            echo "自定义场景"
            ;;
    esac
}

# 应用场景
apply_scenario() {
    local scenario=$1
    local scenario_file="$SCENARIOS_DIR/scenario-${scenario}.json"

    if [ ! -f "$scenario_file" ]; then
        echo -e "${RED}❌ 场景不存在: $scenario${NC}"
        echo ""
        list_scenarios
        exit 1
    fi

    # 备份当前数据
    if [ -f "$TARGET_FILE" ]; then
        cp "$TARGET_FILE" "$TARGET_FILE.backup"
        echo -e "${BLUE}📦 已备份当前数据到: test-data.json.backup${NC}"
    fi

    # 应用新场景
    cp "$scenario_file" "$TARGET_FILE"

    echo -e "${GREEN}✅ 已切换到场景: ${scenario}${NC}"
    echo ""

    # 显示场景描述
    local desc=$(get_scenario_description "$scenario")
    echo -e "${YELLOW}📝 场景说明:${NC}"
    echo "   $desc"
    echo ""

    # 显示订阅信息
    echo -e "${BLUE}📊 场景包含的订阅:${NC}"
    cat "$TARGET_FILE" | grep -E '"subscriptionPlanName"|"resetTimes"|"id"' | \
        awk 'BEGIN {count=0} /"id":/ {id=$2; gsub(/,/, "", id)} /"subscriptionPlanName":/ {name=$2; gsub(/[",]/, "", name)} /"resetTimes":/ {times=$2; gsub(/,/, "", times); count++; printf "   %d. %s (id:%s) - resetTimes=%s\n", count, name, id, times}'
    echo ""

    echo -e "${GREEN}💡 提示:${NC}"
    echo "   - 如果Mock服务器正在运行，数据会自动重新加载"
    echo "   - 恢复备份: cp test-data.json.backup test-data.json"
    echo ""
}

# 主逻辑
if [ $# -eq 0 ] || [ "$1" = "list" ] || [ "$1" = "-l" ] || [ "$1" = "--list" ]; then
    list_scenarios
    exit 0
fi

apply_scenario "$1"
