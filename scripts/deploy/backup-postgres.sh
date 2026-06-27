#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cloudcad}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"

cd "$APP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-cloudcad}"
POSTGRES_USER="${POSTGRES_USER:-cloudcad}"

mkdir -p "$BACKUP_DIR"
backup_file="$BACKUP_DIR/cloudcad-${POSTGRES_DB}-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$backup_file"
echo "Backup written to $backup_file"
