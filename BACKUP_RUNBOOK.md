# Zalkins production backup runbook

The application backup is an encrypted PostgreSQL logical dump intended to
complement the managed Supabase backups. It contains roles, schema and data,
is verified immediately after creation and must be written to an off-site or
independently synced directory.

## Required secrets and destination

Configure these only in the secret store of the backup runner:

- `SUPABASE_DB_URL`: production Postgres connection string.
- `BACKUP_ENCRYPTION_PASSPHRASE`: a dedicated, randomly generated backup key.
  Do not reuse a Supabase or application secret.
- `BACKUP_DIR`: an explicit directory backed by independent off-site storage.

The encryption passphrase must also be escrowed outside the application
infrastructure. Losing it makes every generated archive unrecoverable.

## Run and schedule

Run once manually from the repository root:

```bash
npm run backup:production
```

The command produces:

- `zalkins-postgres-<UTC timestamp>.tar.gz.enc`
- the corresponding `.sha256` file

Schedule the same command daily on a dedicated runner. Inject secrets through
the runner's secret store; never place them in a crontab, shell profile or Git.
Alert when the command exits non-zero or when no new archive appears for 26
hours.

Recommended policy:

- daily backup;
- 35 daily copies and 12 monthly copies;
- immutable/versioned off-site storage;
- quarterly restore drill into an isolated non-production project;
- record the restore time and row-count checks in the current Daily note.

## Restore drill

Decrypt an archive into a temporary location:

```bash
BACKUP_ENCRYPTION_PASSPHRASE='from-secret-store' \
  node scripts/backup-crypto.mjs decrypt \
  /explicit/path/zalkins-postgres-YYYYMMDDTHHMMSSZ.tar.gz.enc \
  /explicit/temporary/path/restore.tar.gz
```

Verify its checksum before decrypting, extract it, and restore in this order:

1. `roles.sql`
2. `schema.sql`
3. `data.sql`

Restore only into an isolated project during a drill. Production recovery
requires an incident owner, a confirmed recovery point and a written approval
of the target database.

## Scope and limitation

This script covers PostgreSQL. Supabase Storage objects require a separate
versioned off-site copy. Point-in-time recovery should still be enabled when
the project plan and billing allow it, because a daily logical dump alone can
lose up to one day of writes.
