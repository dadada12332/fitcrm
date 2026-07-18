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
- Status: resolved
- Module: quality/security
- Environment: all
- Symptoms: регрессии auth, RLS и мобильных сценариев обнаруживаются вручную.
- Expected: CI проверяет TypeScript, критические интеграции и tenant isolation.
- Actual: 80 Vitest checks, 20 Playwright smoke checks и opt-in two-club integration test добавлены; CI отложен из-за GitHub workflow scope.
- Cause: тестовая инфраструктура ещё не создана.
- Workaround: staging DB пока требуется для data-mutating E2E.
- Task: [[Tasks/Completed/TASK-0003-critical-flow-tests]].
- Last checked: 2026-07-18; baseline resolved, расширение coverage продолжается.

## ISSUE-0005 — Dependency advisories в импорте таблиц

- Severity: P1
- Status: resolved
- Module: dependencies/import
- Environment: all
- Symptoms: `npm audit` сообщает 2 high и 4 moderate advisories.
- Expected: нет известных high-severity runtime dependencies.
- Actual: `xlsx` удалён, browser import переведён на ExcelJS; Hono обновлён. `npm audit`: 0 high/critical, остаются 4 moderate transitive advisories Next/PostCSS и ExcelJS/UUID.
- Cause: устаревший клиентский XLSX parser и транзитивные зависимости.
- Workaround: `npm audit fix --force` не применять: npm предлагает ломающие downgrade Next/ExcelJS.
- Task: [[Tasks/Completed/TASK-0007-nochnoi-audit-nadezhnosti-i-proizvoditel-nosti]].
- Last checked: 2026-07-18; high-severity risk resolved.

## ISSUE-0006 — Локальная загрузка уведомлений медленная

- Severity: P2
- Status: open
- Module: notifications/performance
- Environment: local against production Supabase
- Symptoms: `getNotificationsAction()` занимал примерно 0.8–1.7 секунды в dev logs; действие вызывается для badge после загрузки app shell.
- Expected: badge не влияет на интерактивность основной страницы и обновляется быстрее 500 ms warm.
- Actual: три scoped query выполняются параллельно, но auth/club resolution и удалённый production DB заметны при работе с Mac в Ташкенте.
- Cause: remote development latency и отдельный Server Action round trip; production Sydney-to-Sydney требуется замерить отдельно.
- Workaround: основной контент не блокируется; панель уведомлений загружается отдельно.
- Task: отдельный performance task после production telemetry baseline.
- Last checked: 2026-07-18.

## ISSUE-0007 — Recharts предупреждает о размере контейнера в headless/HMR

- Severity: P3
- Status: open
- Module: dashboard/charts
- Environment: local headless Chromium
- Symptoms: warning `width(-1) and height(-1) of chart should be greater than 0` при переходах dashboard во время dev/HMR.
- Expected: chart mounts only after container receives stable dimensions.
- Actual: пользовательский blank chart не воспроизведён, build и E2E проходят; warning повторяется в dev console.
- Cause: ResponsiveContainer измеряется во время промежуточного layout state.
- Workaround: нет пользовательского blocker; проверить с production performance trace.
- Task: отдельный low-priority UI performance task.
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
- Actual: Free plan, PITR disabled, available backups `0`, isolated branches `0`; runbook готов, restore не выполнялся.
- Cause: нет recoverable backup и безопасного target; платная branch требует отдельного cost confirmation.
- Workaround: до upgrade требуется регулярный off-site logical dump и отдельный backup Storage objects.
- Task: [[Tasks/TASK-0004-backup-restore-drill]].
- Last checked: 2026-07-18; task blocked.
