# SnackSpot

Production-ready starter for SnackSpot (web + API + worker) with PostgreSQL/PostGIS, Redis, MinIO, and Docker.

## Quick start

1. Install: `pnpm install`
2. Copy env: `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
3. Start infra: `docker compose -f infra/docker/docker-compose.yml up -d`
4. Run migrations: `pnpm db:migrate`
5. Start apps: `pnpm dev`

## Services

- Web: http://localhost:3000
- API: http://localhost:4000
- MinIO Console: http://localhost:9001
- Postgres: localhost:5432
- Redis: localhost:6379

## Security defaults

- Argon2id password hashing
- Access JWT short-lived + refresh token rotation
- CSRF token endpoint + cookie-based refresh
- Zod validation for all write endpoints
- Helmet security headers
- Rate limiting with Redis-compatible strategy (memory fallback in dev)

See `docs/` for full technical specification, API contracts, threat model, and production checklist.
