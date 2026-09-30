# Contexto de build: raíz del monorepo (necesita packages/shared y el lockfile)
FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY packages/shared/ packages/shared/

# ---------- Build ----------
FROM base AS build
RUN pnpm install --frozen-lockfile --filter "backend..."
COPY backend/ backend/
RUN pnpm --filter backend build

# ---------- Runtime (solo dependencias de producción) ----------
FROM base AS runtime
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --filter "backend..."
COPY --from=build /repo/backend/dist backend/dist
RUN mkdir -p /data/storage && chown -R node:node /data/storage
WORKDIR /repo/backend
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
