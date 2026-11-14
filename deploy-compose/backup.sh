#!/usr/bin/env bash
# PREMAL KAIZEN - daily PostgreSQL backup to S3.
# Runs pg_dump inside the postgres container (never exposes the DB outside the
# container), compresses it, uploads to the private S3 bucket under backups/,
# and prunes anything older than 14 days to keep storage cost near zero.
set -euo pipefail

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="/tmp/premal_backup_${TIMESTAMP}.sql.gz"
S3_BUCKET="premal-kaizen-uploads-518234071157"
S3_PREFIX="backups"

echo "[$(date)] Starting backup..."
sudo docker exec premal-postgres pg_dump -U premal -d premal_kaizen | gzip > "$BACKUP_FILE"

SIZE=$(stat -c%s "$BACKUP_FILE")
if [ "$SIZE" -lt 100 ]; then
  echo "[$(date)] ERROR: backup file suspiciously small ($SIZE bytes) - not uploading, something is wrong."
  exit 1
fi

aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/${S3_PREFIX}/premal_backup_${TIMESTAMP}.sql.gz" --region ap-south-1
echo "[$(date)] Backup uploaded: premal_backup_${TIMESTAMP}.sql.gz (${SIZE} bytes)"

rm -f "$BACKUP_FILE"

# Prune backups older than 14 days (keep S3 cost near zero for a small DB)
CUTOFF=$(date -d '14 days ago' +%Y%m%d)
aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --region ap-south-1 | while read -r line; do
  FNAME=$(echo "$line" | awk '{print $4}')
  FDATE=$(echo "$FNAME" | grep -oE '[0-9]{8}' | head -1)
  if [ -n "$FDATE" ] && [ "$FDATE" -lt "$CUTOFF" ]; then
    echo "[$(date)] Pruning old backup: $FNAME"
    aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${FNAME}" --region ap-south-1
  fi
done

echo "[$(date)] Backup complete."
