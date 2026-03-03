FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json

RUN pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm --filter @snackspot/worker build

CMD ["pnpm", "--filter", "@snackspot/worker", "start"]
