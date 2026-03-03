FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json

RUN pnpm install --no-frozen-lockfile --prod=false

COPY . .
RUN pnpm --filter @snackspot/api build

EXPOSE 4000
CMD ["pnpm", "--filter", "@snackspot/api", "start"]
