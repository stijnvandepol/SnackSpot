#!/usr/bin/env bash
#
# SnackSpot backup: PostgreSQL + MinIO object storage.
#
# Produces, under $BACKUP_DIR/<UTC-timestamp>/:
#   - db.dump        custom-format pg_dump (restore with pg_restore)
#   - objects/       full mirror of the MinIO bucket
#   - MANIFEST.txt   sizes, row/object counts and the git ref for provenance
#
# It is designed to run from the deploy host (where `docker compose` and the
# stack live) as a cron job, e.g. daily at 03:00:
#   0 3 * * *  cd /opt/snackspot && ./scripts/backup.sh >> /var/log/snackspot-backup.log 2>&1
#
# Retention: backups older than $RETENTION_DAYS (default 14) are pruned at the
# end of a successful run. Ship $BACKUP_DIR off-host (rsync/S3) for real DR —
# a backup on the same disk as the data does not survive a disk failure.

set -Eeuo pipefail

# ─── Config (override via env) ────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/snackspot}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE="${COMPOSE:-docker compose}"
DB_SERVICE="${DB_SERVICE:-db}"
MINIO_SERVICE="${MINIO_SERVICE:-minio}"
POSTGRES_USER="${POSTGRES_USER:-snackspot}"
POSTGRES_DB="${POSTGRES_DB:-snackspot}"
MINIO_BUCKET="${MINIO_BUCKET:-snackspot}"
MINIO_ALIAS="local"

timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
dest="${BACKUP_DIR}/${timestamp}"
mkdir -p "${dest}/objects"

log() { echo "[backup $(date -u +%H:%M:%S)] $*"; }

# A partial backup is worse than an obvious failure: drop the directory so a
# half-written backup is never mistaken for a good one.
cleanup_on_error() {
  log "FAILED — removing incomplete backup ${dest}"
  rm -rf "${dest}"
}
trap cleanup_on_error ERR

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
# Custom format (-Fc) so pg_restore can do selective/parallel restores. Run
# inside the db container so no client tooling is needed on the host.
log "Dumping PostgreSQL (${POSTGRES_DB})"
${COMPOSE} exec -T "${DB_SERVICE}" \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc \
  > "${dest}/db.dump"

db_size="$(du -h "${dest}/db.dump" | cut -f1)"
log "PostgreSQL dump: ${db_size}"

# ─── MinIO ────────────────────────────────────────────────────────────────────
# Mirror the whole bucket inside the minio container via the bundled `mc`
# (the image ships mc but not tar), then copy the staged tree to the host with
# `docker compose cp`. The endpoint is the in-container loopback.
log "Mirroring MinIO bucket (${MINIO_BUCKET})"
stage="/tmp/snackspot-backup-stage"
${COMPOSE} exec -T "${MINIO_SERVICE}" sh -c '
  set -e
  rm -rf '"${stage}"'
  mc alias set '"${MINIO_ALIAS}"' http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc mirror --quiet --overwrite '"${MINIO_ALIAS}/${MINIO_BUCKET}"' '"${stage}"' >/dev/null
'
${COMPOSE} cp "${MINIO_SERVICE}:${stage}/." "${dest}/objects"
${COMPOSE} exec -T "${MINIO_SERVICE}" rm -rf "${stage}"

object_count="$(find "${dest}/objects" -type f | wc -l | tr -d ' ')"
objects_size="$(du -sh "${dest}/objects" | cut -f1)"
log "MinIO objects: ${object_count} files, ${objects_size}"

# ─── Manifest ─────────────────────────────────────────────────────────────────
{
  echo "SnackSpot backup"
  echo "created_utc:   ${timestamp}"
  echo "git_ref:       $(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "db_dump_size:  ${db_size}"
  echo "object_count:  ${object_count}"
  echo "objects_size:  ${objects_size}"
} > "${dest}/MANIFEST.txt"

# ─── Retention ────────────────────────────────────────────────────────────────
trap - ERR
log "Pruning backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" \
  -exec rm -rf {} + 2>/dev/null || true

log "DONE — ${dest}"
