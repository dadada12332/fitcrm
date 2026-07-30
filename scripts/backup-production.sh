#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the production Postgres connection string}"
: "${BACKUP_DIR:?Set BACKUP_DIR to an explicit off-site/synced backup directory}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?Set BACKUP_ENCRYPTION_PASSPHRASE in the backup runner secret store}"

case "$BACKUP_DIR" in
  "/"|"."|".."|"$HOME"|"$HOME/"|"~"|"~/")
    echo "BACKUP_DIR must be a dedicated explicit directory" >&2
    exit 1
    ;;
esac

mkdir -p "$BACKUP_DIR"
task_tmp_dir="$(mktemp -d)"
trap 'rm -rf "$task_tmp_dir"' EXIT

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$task_tmp_dir/zalkins-postgres-$timestamp.tar.gz"
encrypted="$BACKUP_DIR/zalkins-postgres-$timestamp.tar.gz.enc"

npx supabase db dump --db-url "$SUPABASE_DB_URL" --file "$task_tmp_dir/roles.sql" --role-only
npx supabase db dump --db-url "$SUPABASE_DB_URL" --file "$task_tmp_dir/schema.sql"
npx supabase db dump --db-url "$SUPABASE_DB_URL" --file "$task_tmp_dir/data.sql" --data-only --use-copy
tar -C "$task_tmp_dir" -czf "$archive" roles.sql schema.sql data.sql

node scripts/backup-crypto.mjs encrypt "$archive" "$encrypted"
node scripts/backup-crypto.mjs decrypt "$encrypted" "$task_tmp_dir/verify.tar.gz"
tar -tzf "$task_tmp_dir/verify.tar.gz" >/dev/null

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$encrypted" > "$encrypted.sha256"
else
  sha256sum "$encrypted" > "$encrypted.sha256"
fi

chmod 600 "$encrypted" "$encrypted.sha256"
echo "Encrypted and verified backup: $encrypted"
