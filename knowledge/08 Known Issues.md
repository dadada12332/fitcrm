---
type: known-issues
updated: 2026-07-18
tags: [fitcrm, risks]
---

# Known Issues

## ISSUE-0001 — Регионы инфраструктуры требуют подтверждения

- Severity: P1
- Status: resolved
- Module: infrastructure/performance
- Environment: production
- Symptoms: потенциальная межрегиональная задержка между Vercel Functions и Postgres.
- Reproduction: сопоставить регионы сервисов и измерить server-side DB round trips.
- Expected: сервисы находятся в близких регионах, latency контролируется.
- Actual: Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы.
- Cause: документация была устаревшей; фактическая topology корректна.
- Workaround: не требуется. Cold latency наблюдается отдельно.
- Task: [[Tasks/Completed/TASK-0002-verify-infrastructure-regions]].
- Last checked: 2026-07-18; resolved.

## ISSUE-0002 — Нет автоматического тестового контура

- Severity: P1
- Status: open
- Module: quality/security
- Environment: all
- Symptoms: регрессии auth, RLS и мобильных сценариев обнаруживаются вручную.
- Expected: CI проверяет TypeScript, критические интеграции и tenant isolation.
- Actual: unit/integration тестов и GitHub Actions нет.
- Cause: тестовая инфраструктура ещё не создана.
- Workaround: `npx tsc --noEmit`, `npm run build`, ручной/Playwright smoke.
- Task: [[Tasks/TASK-0003-critical-flow-tests]].
- Last checked: 2026-07-18.

## ISSUE-0003 — SMS/email уведомления не отправляются

- Severity: P2
- Status: open
- Module: notifications
- Environment: production
- Symptoms: уведомления существуют в UI/БД, но внешняя доставка отсутствует.
- Expected: подтверждённая доставка через настроенных провайдеров.
- Actual: работает Telegram; SMS/email провайдеры не подключены.
- Cause: интеграции не реализованы.
- Workaround: Telegram и ручная коммуникация.
- Task: Backlog, отдельный task-файл пока не нужен.
- Last checked: 2026-07-18.

## ISSUE-0004 — Restore не проверен

- Severity: P1
- Status: open
- Module: infrastructure/database
- Environment: production
- Symptoms: нет подтверждённого сценария восстановления и измеренного RTO/RPO.
- Expected: документированный и проверенный restore drill.
- Actual: доступность резервных копий и процедура не проверены в этой сессии.
- Cause: отсутствует операционная процедура.
- Workaround: нет подтверждённого workaround.
- Task: [[Tasks/TASK-0004-backup-restore-drill]].
- Last checked: 2026-07-18.
