---
type: current-state
status: active
updated: 2026-07-18
tags: [fitcrm, operations]
---

# Current State

## Git и runtime

<!-- AUTO:START repository-state -->
- Версия package: `0.1.0`.
- Branch: `main`.
- Последний commit: 09d44d7 · 2026-07-19T00:12:40+05:00 · Fix dashboard icon and Windows knowledge sync.
- Working tree: есть незакоммиченные изменения.
- Миграции в Git: 64; последняя `0064_telegram_client_identity.sql`.
- Последний production deploy: нет доступных подтверждённых данных.
<!-- AUTO:END repository-state -->

## Готовность модулей

**Работают:** auth и onboarding, dashboard, клиенты, абонементы, посещения, расписание, оплаты, склад, сотрудники, отчёты, настройки, Telegram, Payme/Click, поддержка и основные разделы Platform Admin.

**Частично:** занятия/бронирования, audit trail UI и тарифные ограничения. Telegram automation работает для expiry/class reminders, broadcasts, QR и self-service renewal; recurring auto-charge требует отдельного provider API. AI-аналитика работает как read-only operational workspace с детерминированными KPI и LLM для свободных запросов.

**Не завершено или не подтверждено:** реальные SMS/email, системный мониторинг ошибок, проверенный restore и staging-среда. Базовый Vitest/Playwright/RLS-контур добавлен; data-mutating E2E ждёт отдельную test DB.

## База данных

- В репозитории последовательные миграции `0001`–`0059`; последние Telegram migrations `0056`–`0059` применены к production.
- Bot tokens вынесены из публично читаемой `clubs` в service-only `telegram_integrations`; открытых `clubs.tg_token` в production — `0`.
- Supabase Cron обрабатывает scheduled broadcasts каждые 5 минут; Vercel daily cron отвечает за reminders/report.

См. [[Database/Database State]].

## Окружения

См. [[Infrastructure/Environment Matrix]]. Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы. Production deployment `dpl_4hKacPdixJ9aHgars7ApAT3CLjXN` для commit `09d44d7` имеет статус `READY`; aliases `fitcrm-three.vercel.app` и `fitcrm-crm228.vercel.app` подтверждены.

## Риски и долг

- Warm Supabase health-check составляет 55–167 ms, но зафиксирован cold sample 1162 ms; требуется наблюдение за cold path.
- RLS изолирует tenant, но права модулей зависят от корректности каждой Server Action.
- `npm audit` не фиксирует high/critical advisories; остаются 4 moderate transitive advisories без безопасного автоматического fix.
- В коде остаётся lint-долг (`any`, unused vars, impure `Date.now()`).
- Нет автоматического CI и тестовой матрицы.
- Старые документы дают противоречивую картину реализации.

## Производительность

В июле 2026 устранены повторные auth/club round trips, добавлены индексы `0053`, repair RPC `0054`, lazy loading тяжёлых графиков и оптимистичные UI-обновления. Последний зафиксированный TTFB в `PERF_REPORT.md`: медиана около 127 мс после оптимизации; повторный production-замер после последних коммитов не выполнен.
