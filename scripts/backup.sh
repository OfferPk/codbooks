#!/bin/sh
# CodBooks SQLite Automated Online Backup & Rotation Script
# Safe online backup using SQLite .backup with integrity verification

set -eu

DB_PATH="${DATABASE_PATH:-/app/data/codbooks.db}"
BACKUP_DIR="${BACKUP_DIR:-/app/data/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATE_TAG=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/codbooks_backup_${DATE_TAG}.db"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "[ERROR] Database not found at $DB_PATH" >&2
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting online backup of $DB_PATH -> $BACKUP_FILE..."

# 1. Pre-backup integrity check
INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1 || true)
if [ "$INTEGRITY" != "ok" ]; then
  echo "[ERROR] Database integrity check failed before backup: $INTEGRITY" >&2
  exit 2
fi

# 2. Perform safe hot atomic backup via sqlite3
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# 3. Verify backup file integrity
BACKUP_INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1 || true)
if [ "$BACKUP_INTEGRITY" != "ok" ]; then
  echo "[ERROR] Backup file integrity check failed: $BACKUP_INTEGRITY" >&2
  rm -f "$BACKUP_FILE"
  exit 3
fi

# 4. Compute checksum
if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')
  echo "$CHECKSUM  $(basename "$BACKUP_FILE")" > "${BACKUP_FILE}.sha256"
fi

SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup successfully created: $BACKUP_FILE ($SIZE)"

# 5. Rotate backups older than retention period
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "codbooks_backup_*.db*" -type f -mtime +"$RETENTION_DAYS" -exec rm -f {} +

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup procedure complete."
