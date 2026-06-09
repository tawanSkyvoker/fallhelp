# syntax=docker/dockerfile:1

# ==================== Stage 1: Build ====================
FROM node:24-alpine AS builder

WORKDIR /workspace

ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_audit=false \
    npm_config_fund=false

# Copy monorepo manifests first for better layer caching
COPY package.json package-lock.json ./
COPY patches/ ./patches/
COPY scripts/ ./scripts/
COPY apps/backend-api/package.json ./apps/backend-api/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json

RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Copy only the backend workspace for build
COPY apps/backend-api ./apps/backend-api

WORKDIR /workspace/apps/backend-api
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate && \
    npm run build && \
    node ../../scripts/docker/fix-esm-specifiers.mjs dist

# ==================== Stage 2: Runtime Deps ====================
FROM node:24-alpine AS runtime-deps

WORKDIR /workspace

ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_audit=false \
    npm_config_fund=false

COPY package.json package-lock.json ./
COPY apps/backend-api/package.json ./apps/backend-api/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json

# ติดตั้งเฉพาะ production dependencies ของ backend แบบ clean
# แล้วเติม Prisma CLI กลับมาเพื่อให้ migrate deploy ใน container ยังใช้งานได้
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --workspace apps/backend-api --include-workspace-root=false --omit=dev --ignore-scripts
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund --workspace apps/backend-api --include-workspace-root=false --ignore-scripts --no-save prisma@7.8.0

# ==================== Stage 3: Runtime ====================
FROM node:24-alpine AS runtime

WORKDIR /workspace

RUN apk add --no-cache dumb-init wget && \
    addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown appuser:appgroup /workspace

COPY --chown=appuser:appgroup --from=runtime-deps /workspace/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=builder /workspace/apps/backend-api/package.json ./apps/backend-api/package.json
COPY --chown=appuser:appgroup --from=builder /workspace/apps/backend-api/prisma ./apps/backend-api/prisma
COPY --chown=appuser:appgroup --from=builder /workspace/apps/backend-api/prisma.config.ts ./apps/backend-api/prisma.config.ts
COPY --chown=appuser:appgroup --from=builder /workspace/apps/backend-api/src/generated ./apps/backend-api/src/generated
COPY --chown=appuser:appgroup --from=builder /workspace/apps/backend-api/dist ./apps/backend-api/dist

USER appuser
WORKDIR /workspace/apps/backend-api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/internal/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
