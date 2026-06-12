# SnackSpot Operations Runbook

Operational procedures for backup, restore, deploys and the path to high
availability. Keep this in sync with `docker-compose.yml`, `scripts/backup.sh`
and `.github/workflows/cd.yml`.

---

## Backups

`scripts/backup.sh` captures both data tiers into `$BACKUP_DIR/<UTC-timestamp>/`:

- `db.dump` — custom-format `pg_dump` (restore with `pg_restore`)
- `objects/` — full mirror of the MinIO bucket
- `MANIFEST.txt` — sizes, counts and the git ref at backup time

### Schedule it (deploy host)

```cron
# Daily at 03:00 UTC, log to a file
0 3 * * *  cd /opt/snackspot && ./scripts/backup.sh >> /var/log/snackspot-backup.log 2>&1
```

Tunables (env): `BACKUP_DIR` (default `/var/backups/snackspot`),
`RETENTION_DAYS` (default 14), and the service/credential names if they differ
from the compose defaults.

> **Off-host copy is mandatory for real DR.** A backup on the same disk as the
> live data does not survive a disk failure. Ship `$BACKUP_DIR` elsewhere —
> e.g. `rsync` to another host or `aws s3 sync` to a bucket — as a second cron
> line right after the backup.

### Verify a backup restores (do this monthly)

A backup you have never restored is a guess. Restore into a throwaway database
and confirm row counts. The restore path below is the same one exercised in
testing: `pg_restore` of `db.dump` brings every table back, and MinIO objects
copy straight back into the bucket.

---

## Restore

### PostgreSQL

```bash
# Into the running stack's database (stop the apps first to avoid writes):
docker compose stop web admin worker
DUMP=/var/backups/snackspot/<timestamp>/db.dump
docker compose exec -T db pg_restore -U snackspot -d snackspot --clean --if-exists --no-owner < "$DUMP"
docker compose start web admin worker
```

`--clean --if-exists` drops and recreates objects so the restore is repeatable.
A few "already exists" notices on the PostGIS extension are expected and
harmless. For a fresh database, drop `--clean`.

### MinIO objects

```bash
# Copy the backed-up tree into the minio container, then mc-mirror it back:
docker compose cp /var/backups/snackspot/<timestamp>/objects/. minio:/tmp/restore
docker compose exec -T minio sh -c '
  mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
  mc mirror --overwrite /tmp/restore local/snackspot
  rm -rf /tmp/restore'
```

---

## Deploys

`/.github/workflows/cd.yml` runs on push to `main` (self-hosted runner). The
pipeline now:

1. **Snapshots** the currently-running image ids (for rollback).
2. **Builds** new images without touching running containers — a build failure
   leaves production untouched.
3. **Migrates** explicitly (`docker compose run --rm migrate`) — a migration
   failure aborts the deploy while the old app + schema are still live.
4. **Recreates** the app containers.
5. **Health-gates** on `web` becoming healthy (compose `up` only waits for
   *start*, not *ready*).
6. **Rolls back** to the snapshotted images if any of the above failed.

### Manual rollback

```bash
# List recent images and re-tag the previous one, or just redeploy a known-good ref:
gh workflow run cd.yml -f ref=<previous-good-sha>
```

---

## Migrations

- Runner: `packages/db/scripts/migrate.mjs` (advisory-locked, transactional,
  idempotent via the `_migrations` table).
- **Numbering:** `NNN_snake_case.sql`, strictly increasing. The runner
  hard-fails on any *new* duplicate number. Number `012` is a grandfathered
  historical collision (`KNOWN_DUPLICATE_NUMBERS`) — do not add to that set
  without the same justification (independent migrations, deterministic order,
  unsafe to renumber).
- **No down migrations.** To revert, write a new forward migration.

---

## High-availability path

The current single-host compose stack is correct for ~10–50K MAU. Every data
tier is a single point of failure; the ordered path to HA:

| Tier | Now | Next step | At scale |
|---|---|---|---|
| **PostgreSQL** | 1 instance, local volume | Daily `backup.sh` off-host + WAL archiving | Managed PG (RDS/Cloud SQL) with a primary + read replicas; route reads to replicas |
| **MinIO** | 1 node, 1 disk | `backup.sh` mirror off-host | S3 (or MinIO erasure-coded cluster); serve `variants/*` via CDN |
| **Redis** | 1 instance, RDB only | Enable AOF (`--appendonly yes`) for the job queue | Managed Redis / Sentinel or Cluster |
| **Web / Worker** | 1 each | Already stateless (JWT) — scale `web` behind the LB | Auto-scaling group; worker concurrency = CPU cores, N replicas |
| **Object delivery** | MinIO serves `variants/*` directly | Put a CDN in front of `variants/*` (immutable, cache-forever) | Edge cache + image resizing at the edge |

JWT auth is already stateless, so horizontal scaling of `web` needs no session
affinity — the blockers are purely the stateful tiers above.

---

## Observability gaps (not yet implemented)

Tracked, not done. Highest-value order:

1. **Log shipping** — pino → stdout only today; ship to Loki/ELK/CloudWatch so
   logs survive container restarts.
2. **Uptime + alerting** — external monitor on `/api/health/ready`, alert on
   failure (nobody is paged today).
3. **Metrics** — `/metrics` (Prometheus) or OpenTelemetry auto-instrumentation
   for request latency, query time, queue depth, cache hit rate.
4. **Error tracking** — Sentry for deduplicated exception trends.

---

## Go-live checklist

The application code is production-grade and the full stack builds and boots
healthy via `docker compose up`. The items below are the operator's
responsibility — they need real secrets, accounts, or infra decisions and
cannot be baked into the repo.

### Must do before first production deploy

- [ ] **Secrets**: generate strong unique values for `POSTGRES_PASSWORD`,
      `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`, and 32+ byte `JWT_ACCESS_SECRET` /
      `JWT_REFRESH_SECRET` (`openssl rand -hex 32`). Never reuse the throwaway
      values from local `.env`. Prefer a secret manager over plain compose env.
- [ ] **Third-party keys**: real `RESEND_API_KEY` (transactional email) and
      Cloudflare Turnstile `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- [ ] **TLS + domain**: terminate HTTPS (Cloudflare/again in front of nginx),
      set `NEXT_PUBLIC_APP_URL`, `CORS_ORIGINS`, `MINIO_PUBLIC_URL` to the real
      origins, and `AUTH_COOKIE_SECURE=true`, `TRUST_PROXY=true`.
- [ ] **Web push (optional)**: set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
      (`npx web-push generate-vapid-keys`) or push stays disabled.
- [ ] **Admin access**: lock down the admin app (port 3001) per
      `apps/admin/SECURITY.md` (Cloudflare Tunnel + IP allowlist / VPN).
- [ ] **Backups**: wire `scripts/backup.sh` into cron AND ship `$BACKUP_DIR`
      off-host (see Backups section). Do one restore drill before launch.

### Strongly recommended within the first weeks

- [ ] Error tracking (Sentry) + uptime monitor on `/api/health/ready` + alerts.
- [ ] Move PostgreSQL, Redis and object storage to managed/replicated services
      (see the HA path) before traffic grows past a single host.
- [ ] Verify the CD pipeline (migrate → deploy → health-gate → rollback) on a
      staging run before trusting it in production.

### Already handled in the codebase

Argon2id passwords · refresh-token rotation with theft detection · per-endpoint
rate limiting · strict CSP/HSTS/security headers · same-origin checks · Zod
input validation · magic-byte upload checks · EXIF/GPS stripping · GDPR rights
(export, erasure, retention, audit log) · advisory-locked idempotent migrations ·
non-root read-only containers with resource limits and real healthchecks ·
daily token/photo/review cleanup jobs.
