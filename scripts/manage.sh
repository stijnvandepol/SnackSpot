#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
EXAMPLE_FILE="${ROOT_DIR}/.env.example"
COMPOSE_FILE="${ROOT_DIR}/infra/docker/docker-compose.yml"

usage() {
  cat <<'EOF'
Usage: ./scripts/manage.sh <command>

Commands:
  start     Ensure .env exists, then start/rebuild stack
  update    Pull latest git changes, refresh images, rebuild stack
  stop      Stop stack
  logs      Follow logs (all services or pass SERVICE=<name>)
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

random_hex() {
  local chars="$1"
  local bytes=$((chars / 2))
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "${bytes}"
  else
    head -c "${bytes}" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

get_env_value() {
  local key="$1"
  if [[ -f "${ENV_FILE}" ]]; then
    grep -E "^${key}=" "${ENV_FILE}" | head -n1 | cut -d'=' -f2- || true
  fi
}

upsert_env() {
  local key="$1"
  local value="$2"

  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "${key}=${value}" >> "${ENV_FILE}"
    return
  fi

  if grep -qE "^${key}=" "${ENV_FILE}"; then
    awk -v k="${key}" -v v="${value}" '
      BEGIN { done=0 }
      $0 ~ ("^" k "=") { print k "=" v; done=1; next }
      { print }
      END { if (!done) print k "=" v }
    ' "${ENV_FILE}" > "${ENV_FILE}.tmp"
    mv "${ENV_FILE}.tmp" "${ENV_FILE}"
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

ensure_env_key() {
  local key="$1"
  local default="$2"
  local current
  current="$(get_env_value "${key}")"
  if [[ -z "${current}" ]]; then
    upsert_env "${key}" "${default}"
  fi
}

ensure_env() {
  local created=0

  if [[ ! -f "${ENV_FILE}" ]]; then
    if [[ -f "${EXAMPLE_FILE}" ]]; then
      cp "${EXAMPLE_FILE}" "${ENV_FILE}"
    else
      : > "${ENV_FILE}"
    fi
    created=1
  fi

  local postgres_password
  postgres_password="$(get_env_value POSTGRES_PASSWORD)"
  if [[ -z "${postgres_password}" || "${postgres_password}" == "change-this-db-password" ]]; then
    postgres_password="$(random_hex 32)"
    upsert_env POSTGRES_PASSWORD "${postgres_password}"
  fi

  local minio_secret
  minio_secret="$(get_env_value MINIO_SECRET_KEY)"
  if [[ -z "${minio_secret}" || "${minio_secret}" == "change-this-minio-password" ]]; then
    minio_secret="$(random_hex 32)"
    upsert_env MINIO_SECRET_KEY "${minio_secret}"
  fi

  local minio_access
  minio_access="$(get_env_value MINIO_ACCESS_KEY)"
  if [[ -z "${minio_access}" || "${minio_access}" == "change-this-minio-user" ]]; then
    upsert_env MINIO_ACCESS_KEY "snackspot"
  fi

  local jwt_access
  jwt_access="$(get_env_value JWT_ACCESS_SECRET)"
  if [[ -z "${jwt_access}" || "${jwt_access}" == "change-this-access-secret-min-32-chars" ]]; then
    jwt_access="$(random_hex 64)"
    upsert_env JWT_ACCESS_SECRET "${jwt_access}"
  fi

  local jwt_refresh
  jwt_refresh="$(get_env_value JWT_REFRESH_SECRET)"
  if [[ -z "${jwt_refresh}" || "${jwt_refresh}" == "change-this-refresh-secret-min-32-chars" ]]; then
    jwt_refresh="$(random_hex 64)"
    upsert_env JWT_REFRESH_SECRET "${jwt_refresh}"
  fi

  local database_url
  database_url="$(get_env_value DATABASE_URL)"
  if [[ -z "${database_url}" || "${database_url}" == *"change-this-db-password"* ]]; then
    upsert_env DATABASE_URL "postgresql://snackspot:${postgres_password}@db:5432/snackspot"
  fi

  ensure_env_key REDIS_URL "redis://redis:6379"
  ensure_env_key MINIO_ENDPOINT "minio"
  ensure_env_key MINIO_PORT "9000"
  ensure_env_key MINIO_USE_SSL "false"
  ensure_env_key MINIO_BUCKET "snackspot"
  ensure_env_key MINIO_PUBLIC_URL "http://localhost:9000"
  ensure_env_key MINIO_REGION "us-east-1"
  ensure_env_key MINIO_CORS_ORIGINS "*"
  ensure_env_key MINIO_IMAGE "minio/minio:latest"
  ensure_env_key JWT_ACCESS_EXPIRES_IN "15m"
  ensure_env_key JWT_REFRESH_EXPIRES_DAYS "7"
  ensure_env_key AUTH_COOKIE_SECURE "false"
  ensure_env_key NODE_ENV "production"
  ensure_env_key TRUST_PROXY "true"
  ensure_env_key NEXT_PUBLIC_APP_URL "http://localhost:8080"
  ensure_env_key CORS_ORIGINS "http://localhost:8080,http://127.0.0.1:8080"
  ensure_env_key MAX_FILE_SIZE_BYTES "10485760"
  ensure_env_key MAX_PHOTOS_PER_REVIEW "5"

  if [[ "${created}" -eq 1 ]]; then
    echo "Created ${ENV_FILE} with required fields."
  fi
}

start_stack() {
  compose up -d --build
  echo "App started. Open http://localhost:8080"
}

update_stack() {
  if command -v git >/dev/null 2>&1 && git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "${ROOT_DIR}" pull --ff-only
  fi
  compose pull
  compose up -d --build
  echo "App updated and restarted."
}

main() {
  local cmd="${1:-start}"
  require_cmd docker

  ensure_env

  case "${cmd}" in
    start|up)
      start_stack
      ;;
    update)
      update_stack
      ;;
    stop|down)
      compose down
      ;;
    logs)
      if [[ -n "${SERVICE:-}" ]]; then
        compose logs -f "${SERVICE}"
      else
        compose logs -f
      fi
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "${1:-start}"
