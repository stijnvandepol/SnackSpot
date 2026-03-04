FROM node:20-alpine AS base

# sharp requires build tools on Alpine
RUN apk add --no-cache python3 make g++ vips-dev

RUN npm install -g pnpm@9

WORKDIR /app

# ─── Dependencies ────────────────────────────────────────────────────────────
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/worker/package.json apps/worker/
COPY tsconfig.base.json ./

RUN pnpm install

# ─── Source ──────────────────────────────────────────────────────────────────
COPY packages/ packages/
COPY apps/worker/ apps/worker/

# Generate Prisma client
RUN pnpm --filter @snackspot/db generate

# Build TypeScript
RUN cd apps/worker && npx tsc

# ─── Runtime ────────────────────────────────────────────────────────────────
ENV NODE_ENV=production

CMD ["node", "apps/worker/dist/index.js"]
