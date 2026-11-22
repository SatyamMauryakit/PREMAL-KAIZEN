#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
F=/tmp/premal_backup_${TS}.sql.gz
docker exec premal-postgres pg_dump -U premal -d premal_kaizen | gzip > "$F"
[ "$(stat -c%s "$F")" -gt 100 ] || { echo "backup too small"; exit 1; }
aws s3 cp "$F" "s3://${S3_BUCKET:?set S3_BUCKET}/backups/premal_backup_${TS}.sql.gz" --region ap-south-1
rm -f "$F"
