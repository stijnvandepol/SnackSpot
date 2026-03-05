FROM node:20-alpine AS base

# argon2 + Prisma need build tools and OpenSSL
RUN apk add --no-cache python3 make g++ openssl
RUN npm install -g pnpm@9

WORKDIR /app

# Dependencies
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma/
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
COPY tsconfig.base.json ./

RUN pnpm install && pnpm store prune && rm -rf /root/.cache/pnpm

# Source
COPY packages/ packages/
COPY apps/admin/ apps/admin/

RUN pnpm --filter @snackspot/db generate

# Placeholder server-side env vars for Next.js build analysis.
ENV NODE_ENV=production \
    DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    JWT_ACCESS_SECRET=placeholder-access-secret-at-least-32-chars-long \
    JWT_REFRESH_SECRET=placeholder-refresh-secret-at-least-32-chars-long

RUN pnpm --filter @snackspot/admin build

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl \
  && addgroup -S app \
  && adduser -S -G app app

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=base --chown=app:app /app/apps/admin/.next/standalone ./
COPY --from=base --chown=app:app /app/apps/admin/.next/static ./apps/admin/.next/static

USER app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/admin/server.js"]
