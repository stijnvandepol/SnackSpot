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
