---
type: runbook
status: blocked
updated: 2026-07-18
owner: platform-owner
tags: [fitcrm, supabase, backup, restore]
---

# Backup and Restore Runbook

## Current protection

- Supabase organization plan: Free.
- Management API: WAL-G physical pipeline enabled, PITR disabled, available backups `0`.
- Development/restore branches: `0`.
- Current RPO: unbounded; there is no confirmed recoverable copy.
- Current RTO: unmeasured; restore cannot be drilled without an isolated target.
- Accountable owner: platform owner. Drill executor: on-call engineer/Codex.

This is a launch blocker. Do not restore over production as a test.

## Required target state

1. Upgrade to a plan with daily backups or enable PITR. Daily backup gives up to 24-hour RPO; PITR documentation states a worst-case RPO of about two minutes.
2. Create a disposable Supabase branch/project in the same Postgres major version and region.
3. Keep an off-site logical dump and a separate Storage object backup. Supabase database backups include Storage metadata, not object bytes.
4. Run this drill quarterly and after material schema/Auth changes.

## Preflight

- Record incident time, desired recovery point and approver.
- Freeze schema deploys and destructive jobs; do not pause production for an isolated drill.
- Record production counts only, never row contents or secrets.
- Confirm target URL is not production and target has no external webhooks, Telegram, email or payment callbacks enabled.
- Capture database dump, auth schema, storage metadata and Storage objects according to current Supabase backup documentation.

## Restore drill

1. Restore the selected physical/PITR snapshot to the disposable target, or restore the encrypted logical dump with Supabase CLI/`pg_restore`.
2. Reapply custom role passwords because hosted daily backups do not preserve them.
3. Restore Storage object bytes separately; restoring database metadata alone is insufficient.
4. Point only local verification credentials at the target.
5. Run:

```bash
RESTORE_SUPABASE_URL=... \
RESTORE_SUPABASE_SERVICE_ROLE_KEY=... \
RESTORE_CONFIRM_ISOLATED_TARGET=yes \
node scripts/verify-restore.mjs
```

6. Compare non-PII counts against the approved baseline and verify:
   - 38 `public` tables and RLS enabled on all exposed tables;
   - Auth users resolve to `public.users`/`staff` without broken ownership;
   - clubs, clients, memberships, subscriptions, payments and visits have expected counts;
   - Storage buckets, metadata and representative object downloads work;
   - critical RPCs, triggers and migration `0055` grants exist;
   - login, client lookup, subscription view, check-in and reports work on the target.
7. Record elapsed restore time as RTO and backup age as achieved RPO.

## Rollback and cleanup

- Never promote the drill target automatically.
- If validation fails, preserve logs/counts, destroy the disposable target and keep production untouched.
- Revoke temporary target keys and remove downloaded dumps from working directories.
- Re-enable target integrations only if the restored project becomes an approved recovery environment.
- Delete the branch/project after the report is accepted to stop charges.

## Production recovery

Production restore requires an incident, explicit recovery point, downtime notice and platform-owner approval. Before restore, stop writes and external callbacks; after restore, rotate affected credentials, verify auth/RLS/storage/integrations, then reopen traffic. Supabase notes that the project is inaccessible during in-place restore.

## Baseline 2026-07-18

Counts only: 38/38 public tables with RLS, 24 Auth users, 3 Storage buckets, 1 Storage object, 18 clubs, 26 staff, 23,204 clients, 19 memberships, 7,012 subscriptions, 10,447 payments and 4,941 visits.

Sources: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups), [Backup/restore migration guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
