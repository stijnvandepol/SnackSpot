FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm --filter @snackspot/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@snackspot/web", "start"]
