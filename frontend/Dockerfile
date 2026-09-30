# Contexto de build: raíz del monorepo
FROM node:24-slim AS build
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/shared/ packages/shared/
RUN pnpm install --frozen-lockfile --filter "frontend..."
COPY frontend/ frontend/
RUN pnpm --filter frontend build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
