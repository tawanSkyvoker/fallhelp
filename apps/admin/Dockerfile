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

# Copy only the admin workspace for build
COPY apps/admin ./apps/admin

WORKDIR /workspace/apps/admin

ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ==================== Stage 2: Serve ====================
FROM nginx:1.29-alpine AS production

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/admin/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
