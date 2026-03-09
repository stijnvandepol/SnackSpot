FROM node:20-alpine AS base

# argon2 + Prisma need build tools and OpenSSL
RUN apk add --no-cache python3 make g++ openssl
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Dependencies
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY tsconfig.base.json ./

RUN pnpm install && pnpm store prune && rm -rf /root/.cache/pnpm

# Source
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN mkdir -p /app/apps/web/public

RUN pnpm --filter @snackspot/db generate

# Build-time public vars
ARG NEXT_PUBLIC_APP_URL=https://snackspot.online
ARG NEXT_PUBLIC_MINIO_PUBLIC_URL=https://snackspot.online
ARG NEXT_PUBLIC_MINIO_BUCKET=snackspot
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MINIO_PUBLIC_URL=$NEXT_PUBLIC_MINIO_PUBLIC_URL
ENV NEXT_PUBLIC_MINIO_BUCKET=$NEXT_PUBLIC_MINIO_BUCKET

# Placeholder server-side env vars for Next.js build analysis.
ENV NODE_ENV=production \
    DATABASE_URL=postgresql://placeholder:placeholder@db:5432/placeholder \
    REDIS_URL=redis://redis:6379 \
    MINIO_ENDPOINT=minio \
    MINIO_ACCESS_KEY=placeholder-key \
    MINIO_SECRET_KEY=placeholder-secret-key-min \
    MINIO_PUBLIC_URL=https://snackspot.online \
    JWT_ACCESS_SECRET=placeholder-access-secret-at-least-32-chars-long \
    JWT_REFRESH_SECRET=placeholder-refresh-secret-at-least-32-chars-long

RUN pnpm --filter web build

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl \
  && addgroup -S app \
  && adduser -S -G app app

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=base --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=base --chown=app:app /app/apps/web/public ./apps/web/public

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
