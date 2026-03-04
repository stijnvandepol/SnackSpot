FROM node:20-alpine AS base

# argon2 needs build tools
RUN apk add --no-cache python3 make g++

RUN npm install -g pnpm@9

WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
COPY pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY tsconfig.base.json ./

RUN pnpm install

# ─── Source ───────────────────────────────────────────────────────────────────
COPY packages/ packages/
COPY apps/web/ apps/web/

# Prisma generate (needs schema path)
RUN pnpm --filter @snackspot/db generate

# Expose env vars needed at build time (Next.js NEXT_PUBLIC_*)
# These are baked in at build time; set them via docker-compose build args
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_MINIO_PUBLIC_URL=http://localhost:9000
ARG NEXT_PUBLIC_MINIO_BUCKET=snackspot
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MINIO_PUBLIC_URL=$NEXT_PUBLIC_MINIO_PUBLIC_URL
ENV NEXT_PUBLIC_MINIO_BUCKET=$NEXT_PUBLIC_MINIO_BUCKET

# Build Next.js
ENV NODE_ENV=production
RUN pnpm --filter web build

# ─── Runtime (standalone) ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache python3 make g++

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /app/apps/web/.next/standalone ./
COPY --from=base /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=base /app/apps/web/public           ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
