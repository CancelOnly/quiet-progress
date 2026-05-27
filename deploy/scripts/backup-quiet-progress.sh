#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/quiet-progress}"
DB_PATH="${DB_PATH:-$APP_DIR/quiet_progress.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/quiet-progress}"
TIMESTAMP="$(date +%F_%H%M%S)"
DEST="$BACKUP_DIR/quiet_progress_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "[backup] sqlite3 não encontrado. Instale: sudo apt install sqlite3"
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] banco não encontrado em: $DB_PATH"
  exit 1
fi

sqlite3 "$DB_PATH" ".backup '$DEST'"

chmod 600 "$DEST"

echo "[backup] criado: $DEST"
