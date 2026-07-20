---
type: database-state
updated: 2026-07-18
---

# Database State

## Repository facts

- 55 SQL migrations under `supabase/migrations/`, from `0001` to `0055`.
- Latest: `0055_harden_public_rpcs.sql`, applied and verified on production.
- Security hardening: `0051_security_hardening.sql` and `0052_staff_escalation_guard.sql`.
- Performance: `0053_perf_indexes.sql` and `0054_performance_roundtrip_repair.sql`.

## Domains

Core tables cover clubs/users/staff, clients/subscriptions/memberships, visits/classes/schedules, payments/acquiring, warehouse, plans/billing, platform administration, Telegram/notifications and support.

RPCs cover layout/dashboard context, KPI, paginated clients/payments/visits, reports, inventory counters, platform metrics and tenant helpers.

## Runtime status

- `growth_experiment_runs` хранит club-scoped lifecycle Growth OS; RLS разрешает участникам клуба только чтение, а записи выполняются service-side после permission check. Миграции `0073` и `20260720154135` применены и проверены.
- Production имеет 38/38 `public` tables с RLS; миграция `0055` проверена по grants/prosecdef.
- Supabase region: `ap-southeast-2` (Sydney), рядом с Vercel `syd1`.
- Backup availability проверена: Free plan, PITR off, snapshots `0`; restore drill blocked до isolated target.
- Generated TypeScript database types: отсутствуют или не подтверждены.

## Change rules

Схема изменяется новой миграцией. Перед production-применением проверяются RLS, grants, `SECURITY DEFINER`, tenant scope и rollback/compatibility. Секреты и production connection strings в заметки не записываются.
