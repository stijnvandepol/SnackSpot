FROM node:20-alpine AS builder

# sharp + Prisma require build toolchain on Alpine
RUN apk add --no-cache python3 make g++ vips-dev openssl
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Dependencies
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/worker/package.json apps/worker/
COPY tsconfig.base.json ./

RUN pnpm install --frozen-lockfile && pnpm store prune && rm -rf /root/.cache/pnpm

# Source
COPY packages/ packages/
COPY apps/worker/ apps/worker/

RUN pnpm --filter @snackspot/db generate
RUN pnpm --filter worker build

FROM node:20-alpine AS runner

RUN apk add --no-cache vips openssl \
  && addgroup -S app \
  && adduser -S -G app app

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=app:app /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder --chown=app:app /app/packages/db/prisma ./packages/db/prisma

USER app

HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 \
  CMD node -e "const Redis=require('ioredis');const r=new Redis(process.env.REDIS_URL);r.ping().then(()=>r.quit()).then(()=>process.exit(0)).catch(()=>process.exit(1))"

CMD ["node", "apps/worker/dist/index.js"]
