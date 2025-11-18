# 88code 测试框架

本测试框架提供完整的本地测试环境，用于调试和验证88code重置服务的逻辑。

## 🚀 快速开始

```bash
# 一键测试（推荐）
./test/run-test.sh both

# 只测试第一次检查点
./test/run-test.sh first

# 只测试第二次检查点
./test/run-test.sh second

# 启动守护进程模式
./test/run-test.sh daemon
```

## 📁 文件结构

```
test/
├── mock-api/                       # Mock API服务器
│   ├── server.mjs                  # Mock服务器主文件
│   ├── test-data.json              # 测试数据（可随时修改）
│   └── README.md                   # Mock API使用说明
├── .env.test                       # 测试环境配置
├── run-test.sh                     # 一键测试脚本
└── README.md                       # 本文档
```

## 🎯 核心功能

### 1. Mock API 服务器
- 模拟88code API的响应
- 支持热重载：修改 `test-data.json` 自动生效
- 完整API模拟：支持订阅列表、重置额度等接口

### 2. 本地文件通知器
- 将通知写入本地文件：`notifications/notification-*.txt`
- 作为正式的通知器类型（与Telegram、企业微信并列）
- 可通过环境变量启用/禁用

### 3. 一键测试脚本
- 自动启动/停止Mock服务器
- 自动切换测试配置
- 自动清理和恢复环境

## 🔧 配置说明

测试配置文件：`test/.env.test`

关键配置：
```bash
# 使用Mock API
API_BASE_URL=http://localhost:3888

# 启用本地文件通知
ENABLE_LOCAL_FILE_NOTIFIER=true
LOCAL_FILE_NOTIFIER_OUTPUT_DIR=./notifications

# 关闭真实通知
ENABLE_TELEGRAM=false
ENABLE_WECOM=false
```

## 📊 查看测试结果

```bash
# 查看日志
tail -f logs/app-*.log

# 查看通知文件
ls -lh notifications/
cat notifications/notification-*.txt
```

详细使用说明请查看 `test/mock-api/README.md`
