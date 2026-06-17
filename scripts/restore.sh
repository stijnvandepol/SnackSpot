#!/usr/bin/env bash
#
# SnackSpot restore: PostgreSQL + MinIO object storage, from a backup produced
# by scripts/backup.sh.
#
# DESTRUCTIVE — it overwrites the live database and object storage. It refuses
# to run unless explicitly confirmed:
#   CONFIRM=yes ./scripts/restore.sh [BACKUP_DIR]
#
# BACKUP_DIR defaults to the newest snapshot under $BACKUP_ROOT. By default the
# app containers (web/admin/worker) are stopped during the restore so nothing
# holds open DB connections or reads half-restored data, then restarted.
#
# In this repo it is normally driven by .github/workflows/restore.yml on the
# self-hosted production runner (manual, with a typed confirmation).

set -Eeuo pipefail

# ─── Config (override via env) ────────────────────────────────────────────────
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/snackspot}"
COMPOSE="${COMPOSE:-docker compose}"
DB_SERVICE="${DB_SERVICE:-db}"
MINIO_SERVICE="${MINIO_SERVICE:-minio}"
POSTGRES_USER="${POSTGRES_USER:-snackspot}"
POSTGRES_DB="${POSTGRES_DB:-snackspot}"
MINIO_BUCKET="${MINIO_BUCKET:-snackspot}"
MINIO_ALIAS="local"
APP_SERVICES="${APP_SERVICES:-web admin worker}"
STOP_APP="${STOP_APP:-1}"            # pause app containers during the restore
# Delete objects newer than the backup so storage exactly matches the snapshot.
# Off by default — a restore then never destroys data uploaded after the backup.
MIRROR_REMOVE="${MIRROR_REMOVE:-0}"

# Source: explicit arg, else the newest backup directory.
src="${1:-}"
if [ -z "${src}" ]; then
  src="$(ls -1dt "${BACKUP_ROOT}"/*/ 2>/dev/null | head -n 1 || true)"
fi
src="${src%/}"

log() { echo "[restore $(date -u +%H:%M:%S)] $*"; }
die() { echo "[restore] ERROR: $*" >&2; exit 1; }

[ -n "${src}" ] || die "no backup directory found under ${BACKUP_ROOT} (pass one as an argument)"
[ -d "${src}" ] || die "backup directory does not exist: ${src}"
[ -f "${src}/db.dump" ] || die "missing ${src}/db.dump"

if [ "${CONFIRM:-}" != "yes" ]; then
  echo "About to RESTORE from: ${src}"
  [ -f "${src}/MANIFEST.txt" ] && cat "${src}/MANIFEST.txt"
  die "refusing to run without confirmation. Re-run with CONFIRM=yes"
fi

log "Restoring from ${src}"
[ -f "${src}/MANIFEST.txt" ] && cat "${src}/MANIFEST.txt"

restart_app() { :; }
if [ "${STOP_APP}" = "1" ]; then
  log "Stopping app containers (${APP_SERVICES}) to release DB connections"
  # shellcheck disable=SC2086 -- intentional word-splitting of the service list
  ${COMPOSE} stop ${APP_SERVICES} || true
  # Always bring them back, even if the restore fails partway.
  restart_app() {
    log "Restarting app containers (${APP_SERVICES})"
    # shellcheck disable=SC2086
    ${COMPOSE} start ${APP_SERVICES} || true
  }
  trap restart_app EXIT
fi

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
# Custom-format dump → pg_restore. --clean --if-exists drops existing objects
# first so the restore is idempotent; --no-owner/--no-acl avoid role mismatches.
log "Restoring PostgreSQL (${POSTGRES_DB})"
${COMPOSE} exec -T "${DB_SERVICE}" \
  pg_restore --clean --if-exists --no-owner --no-acl \
  -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  < "${src}/db.dump"
log "PostgreSQL restored"

# ─── MinIO ────────────────────────────────────────────────────────────────────
# Stage the backed-up objects into the minio container, then mirror them back
# into the bucket. --overwrite replaces changed objects; --remove (opt-in) also
# deletes objects that aren't in the backup, making the bucket match exactly.
if [ -d "${src}/objects" ]; then
  log "Restoring MinIO objects into bucket (${MINIO_BUCKET})"
  stage="/tmp/snackspot-restore-stage"
  ${COMPOSE} exec -T "${MINIO_SERVICE}" sh -c "rm -rf '${stage}' && mkdir -p '${stage}'"
  ${COMPOSE} cp "${src}/objects/." "${MINIO_SERVICE}:${stage}"
  remove_flag=""
  [ "${MIRROR_REMOVE}" = "1" ] && remove_flag="--remove"
  ${COMPOSE} exec -T "${MINIO_SERVICE}" sh -c '
    set -e
    mc alias set '"${MINIO_ALIAS}"' http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    mc mirror --quiet --overwrite '"${remove_flag}"' '"${stage}"' '"${MINIO_ALIAS}/${MINIO_BUCKET}"' >/dev/null
    rm -rf '"${stage}"'
  '
  log "MinIO objects restored"
else
  log "No objects/ in backup — skipping MinIO restore"
fi

log "DONE — restored from ${src}"
