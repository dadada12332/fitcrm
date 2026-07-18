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
- Branch: `codex/night-autonomy-2026-07-18`.
- Последний commit: 32f4975 · 2026-07-18T11:06:09+05:00 · Add security regression tests and harden public RPCs.
- Working tree: есть незакоммиченные изменения.
- Миграции в Git: 55; последняя `0055_harden_public_rpcs.sql`.
- Последний production deploy: нет доступных подтверждённых данных.
<!-- AUTO:END repository-state -->

## Готовность модулей

**Работают:** auth и onboarding, dashboard, клиенты, абонементы, посещения, расписание, оплаты, склад, сотрудники, отчёты, настройки, Telegram, Payme/Click, поддержка и основные разделы Platform Admin.

**Частично:** занятия/бронирования, автоматизация уведомлений, audit trail UI, тарифные ограничения, AI-аналитика без полноценного LLM-чата.

**Не завершено или не подтверждено:** реальные SMS/email, системный мониторинг ошибок, проверенный restore и staging-среда. Базовый Vitest/Playwright/RLS-контур добавлен; data-mutating E2E ждёт отдельную test DB.

## База данных

- В репозитории 54 последовательные миграции `0001`–`0054`.
- Последняя миграция: `0054_performance_roundtrip_repair.sql`.
- Обнаружено 38 основных `public` таблиц и RPC для layout, dashboard, пагинации, отчётов и Platform Admin.
- Факт применения всех 54 миграций к production: не проверено в этой сессии.

См. [[Database/Database State]].

## Окружения

См. [[Infrastructure/Environment Matrix]]. Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы. Последний production deploy `abedb02` имеет статус `READY`.

## Риски и долг

- Warm Supabase health-check составляет 55–167 ms, но зафиксирован cold sample 1162 ms; требуется наблюдение за cold path.
- RLS изолирует tenant, но права модулей зависят от корректности каждой Server Action.
- `npm audit` фиксирует high advisories в `xlsx`; требуется замена parser без force downgrade.
- В коде остаётся lint-долг (`any`, unused vars, impure `Date.now()`).
- Нет автоматического CI и тестовой матрицы.
- Старые документы дают противоречивую картину реализации.

## Производительность

В июле 2026 устранены повторные auth/club round trips, добавлены индексы `0053`, repair RPC `0054`, lazy loading тяжёлых графиков и оптимистичные UI-обновления. Последний зафиксированный TTFB в `PERF_REPORT.md`: медиана около 127 мс после оптимизации; повторный production-замер после последних коммитов не выполнен.
