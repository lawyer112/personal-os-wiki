FROM node:24-alpine AS deps
WORKDIR /app

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_GENERATE_DATABASE_URL=postgresql://build-time-placeholder:build-time-placeholder@127.0.0.1:1/build?schema=public
ENV HTTP_PROXY=$HTTP_PROXY
ENV HTTPS_PROXY=$HTTPS_PROXY
ENV npm_config_registry=$NPM_CONFIG_REGISTRY
ENV DATABASE_URL=$PRISMA_GENERATE_DATABASE_URL

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --ignore-scripts --no-audit --no-fund \
  --registry=$NPM_CONFIG_REGISTRY \
  --fetch-retries=5 \
  --fetch-retry-mintimeout=20000 \
  --fetch-retry-maxtimeout=120000 \
  --fetch-timeout=120000

FROM node:24-alpine AS builder
WORKDIR /app

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_GENERATE_DATABASE_URL=postgresql://build-time-placeholder:build-time-placeholder@127.0.0.1:1/build?schema=public
ENV HTTP_PROXY=$HTTP_PROXY
ENV HTTPS_PROXY=$HTTPS_PROXY
ENV npm_config_registry=$NPM_CONFIG_REGISTRY
ENV DATABASE_URL=$PRISMA_GENERATE_DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/docs ./docs

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
