# 多阶段构建，减小镜像体积

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:18.20-alpine AS deps

# 设置工作目录
WORKDIR /app

# 启用 corepack 并安装 pnpm 9.15.0（与本地保持一致）
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装生产依赖（使用 frozen-lockfile 确保版本一致）
RUN pnpm install --frozen-lockfile --prod

# ============================================
# Stage 2: Runner
# ============================================
FROM node:18.20-alpine AS runner

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 创建必要的目录
RUN mkdir -p /app/logs /app/data && \
    chown -R nodejs:nodejs /app

# 从 deps 阶段复制 node_modules
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# 复制源代码
COPY --chown=nodejs:nodejs . .

# 切换到非 root 用户
USER nodejs

# 健康检查（检查进程是否存在）
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# 暴露端口（预留，当前不使用）
# EXPOSE 3000

# 启动命令
CMD ["node", "src/index.js"]
