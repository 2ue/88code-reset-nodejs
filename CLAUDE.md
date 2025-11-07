# 88code Reset Service - 项目开发规则

本文档定义了本项目的开发规范和约束，所有 AI 助手和开发者都应遵守这些规则。

---

## 📋 核心规则

### 1. 文档创建规则

**禁止自动创建任何文档**

- ❌ 不得在未经明确许可的情况下创建任何文档文件
- ❌ 不得自动生成 README、总结报告、分析文档等
- ✅ 只有在用户明确要求时才能创建新文档
- ✅ 修改现有文档需要用户明确同意

**适用范围**：
- 所有 `.md` 文件
- 所有 `.txt` 文件
- 所有文档类型的文件（README、CHANGELOG、报告等）

**例外情况**：
- 用户明确说"创建文档"、"生成报告"等指令
- 用户提供了具体的文档名称和要求

---

### 2. 环境变量配置文件同步规则

**当修改 `.env.example` 时，必须同步更新 `.env.doc.example`**

**规则说明**：
- ✅ 新增变量时，需在两个文件中同步添加
- ✅ 删除变量时，需在两个文件中同步删除
- ✅ 修改变量名或默认值时，需在两个文件中同步修改
- ⚠️ 注释格式必须严格遵守

**文件格式要求**：

`.env.example` 格式（详细注释在上方）：
```bash
# ==================== 分类标题 ====================

# 变量作用的详细注释
# 可以多行说明
VARIABLE_NAME=default_value
```

`.env.doc.example` 格式（简洁注释在下方）：
```bash
VARIABLE_NAME=default_value
# 变量作用的简洁注释（单行）
```

**示例**：

新增变量时，需要同时在两个文件中添加：

`.env.example`:
```bash
# 新功能开关
# 是否启用某某功能
ENABLE_NEW_FEATURE=false
```

`.env.doc.example`:
```bash
ENABLE_NEW_FEATURE=false
# 是否启用某某功能
```

---

## 🔧 开发规范

### 代码修改原则

1. **最小化修改**：只修改必要的部分
2. **保持兼容**：不破坏现有功能
3. **先验证再提交**：确保代码能正常运行

### 代码质量要求

1. **注释清晰**：复杂逻辑必须添加注释
2. **错误处理**：所有异步操作都要有错误处理
3. **日志完整**：关键操作都要记录日志

---

## 📚 项目结构说明

### 核心模块

- `src/core/` - 核心业务逻辑
  - `ResetService.js` - 重置服务
  - `APIClient.js` - API 客户端
  - `Scheduler.js` - 定时任务调度
  - `DynamicTimerManager.js` - 动态定时器管理

- `src/utils/` - 工具类
  - `TimeUtils.js` - 时间处理工具
  - `ConfigValidator.js` - 配置验证工具
  - `Logger.js` - 日志工具
  - `RateLimiter.js` - 速率限制

- `src/storage/` - 数据存储
  - `FileStorage.js` - 文件存储

### 关键约束

1. **循环依赖**：注意避免模块间的循环依赖
   - `config.js → ConfigValidator → TimeUtils → constants → config` 存在循环依赖
   - `parseTime` 方法在两处保留重复实现

2. **时区处理**：所有时间操作都使用配置的时区 `config.timezone`

3. **冷却期**：默认 5 小时，可通过 `COOLDOWN_HOURS` 配置

---

## 🚨 重要提醒

### 修改代码前必读

1. **理解策略文档**：`docs/reset-strategy-simple.md`
2. **检查影响范围**：修改前评估影响
3. **验证功能**：修改后运行 `npm run test` 或 `node src/cli.js --stats`

### 已知问题

参考 `docs/code-analysis-report.md` 了解已知问题和修复状态

---

## 📝 变更记录

### 2025-11-07
- 添加项目规则文档
- 明确禁止自动创建文档的规则
- 添加环境变量配置文件同步规则
- 修复启动错误和延迟重置BUG

---

**最后更新**：2025-11-07
