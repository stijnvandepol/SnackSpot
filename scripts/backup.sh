#!/usr/bin/env bash
#
# SnackSpot backup: PostgreSQL + MinIO object storage.
#
# Produces, under $BACKUP_DIR/<UTC-timestamp>/:
#   - db.dump        custom-format pg_dump (restore with pg_restore)
#   - objects/       full mirror of the MinIO bucket
#   - MANIFEST.txt   sizes, row/object counts and the git ref for provenance
#
# It runs from the deploy host (where `docker compose` and the stack live).
# In this repo it is driven weekly by .github/workflows/backup.yml on the
# self-hosted production runner; it can equally run from a host cron, e.g.:
#   0 3 * * 0  cd /opt/snackspot && ./scripts/backup.sh >> /var/log/snackspot-backup.log 2>&1
#
# Retention: only the newest $KEEP_LAST backups are kept (default 1 — a single
# rolling snapshot); older ones are pruned after a successful run. Ship
# $BACKUP_DIR off-host (the backup workflow can upload it as an artifact) for
# real DR — a backup on the same disk as the data does not survive a disk
# failure. Restore with scripts/restore.sh.

set -Eeuo pipefail

# ─── Config (override via env) ────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/snackspot}"
KEEP_LAST="${KEEP_LAST:-1}"
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
# Keep only the newest $KEEP_LAST backups. The one just written is newest, so it
# is always retained; everything past the cutoff is removed. Pruning runs only
# after a successful backup (ERR trap cleared), so a failed run never deletes the
# previous good snapshot.
trap - ERR
log "Pruning old backups (keeping newest ${KEEP_LAST})"
# shellcheck disable=SC2012 -- dir names are ISO timestamps; ls -t ordering is safe
ls -1dt "${BACKUP_DIR}"/*/ 2>/dev/null | tail -n "+$((KEEP_LAST + 1))" | while read -r old; do
  log "  removing old backup ${old}"
  rm -rf "${old}"
done

log "DONE — ${dest}"
