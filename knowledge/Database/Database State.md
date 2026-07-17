---
type: database-state
updated: 2026-07-18
---

# Database State

## Repository facts

- 54 SQL migrations under `supabase/migrations/`, from `0001` to `0054`.
- Latest: `0054_performance_roundtrip_repair.sql`.
- Security hardening: `0051_security_hardening.sql` and `0052_staff_escalation_guard.sql`.
- Performance: `0053_perf_indexes.sql` and `0054_performance_roundtrip_repair.sql`.

## Domains

Core tables cover clubs/users/staff, clients/subscriptions/memberships, visits/classes/schedules, payments/acquiring, warehouse, plans/billing, platform administration, Telegram/notifications and support.

RPCs cover layout/dashboard context, KPI, paginated clients/payments/visits, reports, inventory counters, platform metrics and tenant helpers.

## Runtime status

- Применение миграций к production: не проверено.
- Supabase project region: не проверено.
- Backup и restore drill: не проверено.
- Generated TypeScript database types: отсутствуют или не подтверждены.

## Change rules

Схема изменяется новой миграцией. Перед production-применением проверяются RLS, grants, `SECURITY DEFINER`, tenant scope и rollback/compatibility. Секреты и production connection strings в заметки не записываются.
