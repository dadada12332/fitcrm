---
type: current-state
status: active
updated: 2026-07-20
tags: [fitcrm, operations]
---

# Current State

## Git и runtime

<!-- AUTO:START repository-state -->
- Версия package: `0.1.0`.
- Branch: `main`.
- Последний commit: 7716f9d · 2026-07-20T14:04:04+05:00 · docs: record verified production hardening [skip ci].
- Working tree: есть незакоммиченные изменения.
- Миграции в Git: 68; последняя `0068_staff_page_aggregate.sql`.
- Последний production deploy: нет доступных подтверждённых данных.
<!-- AUTO:END repository-state -->

## Готовность модулей

**Работают:** auth и onboarding, dashboard, клиенты, абонементы, посещения, расписание, оплаты, склад, сотрудники, отчёты, настройки, Telegram, Payme/Click, поддержка и основные разделы Platform Admin. Beta-раздел удержания и Growth OS из восьми связанных инструментов выпущены в production и проверены на синтетическом QA-клубе.

**Частично:** занятия/бронирования, audit trail UI и тарифные ограничения. Telegram automation работает для expiry/class reminders, broadcasts, QR и self-service renewal; recurring auto-charge требует отдельного provider API. AI-аналитика работает как read-only operational workspace с детерминированными KPI и LLM для свободных запросов.

**Не завершено или не подтверждено:** custom SMTP и реальные SMS, системный мониторинг ошибок, проверенный restore, staging-среда и provider-certified Payme/Click flow. Массовый запуск имеет статус NO-GO; controlled beta — GO. См. [[Reports/Launch Readiness 2026-07-20]].

## База данных

- В репозитории последовательные миграции `0001`–`0067`; launch hardening `0065`–`0067` применён к production.
- Bot tokens вынесены из публично читаемой `clubs` в service-only `telegram_integrations`; открытых `clubs.tg_token` в production — `0`.
- Supabase Cron обрабатывает scheduled broadcasts каждые 5 минут; Vercel daily cron отвечает за reminders/report.

См. [[Database/Database State]].

## Окружения

См. [[Infrastructure/Environment Matrix]]. Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы. Production deployment `dpl_8Kye9UKe6VGpHWSmaoAb7byuUkks` для merge commit `0514d3d` имеет статус `READY`; aliases `fitcrm-three.vercel.app` и `fitcrm-crm228.vercel.app` подтверждены. Авторизованный `/growth` проверен на отдельном синтетическом QA-клубе без клиентских данных; credentials хранятся только локально.

## Риски и долг

- Warm Supabase health-check составляет 55–167 ms, но зафиксирован cold sample 1162 ms; требуется наблюдение за cold path.
- RLS изолирует tenant, но права модулей зависят от корректности каждой Server Action.
- `npm audit` не фиксирует high/critical advisories; остаются 4 moderate transitive advisories без безопасного автоматического fix.
- В коде остаётся lint-долг (`any`, unused vars, impure `Date.now()`).
- Пороги retention scoring пока являются детерминированными продуктовыми гипотезами и требуют калибровки на обезличенной статистике после проверки владельцем.
- Growth health score, recovery rates и expected impact являются прозрачными сценарными assumptions, а не ML-прогнозом или обещанием результата.
- На диске `E:` Next.js/Playwright зафиксировал slow filesystem benchmark 288 ms; функциональные тесты прошли, но dev feedback loop может быть медленнее.
- Нет автоматического CI, error monitoring и production-like staging.
- Supabase Free не даёт managed daily backups и leaked-password protection; custom SMTP/CAPTCHA не настроены.
- Full ESLint baseline: 122 errors и 45 warnings; TypeScript, build и runtime tests проходят.
- Старые документы дают противоречивую картину реализации.

## Производительность

В июле 2026 устранены повторные auth/club round trips, добавлены индексы `0053`, repair RPC `0054`, lazy loading тяжёлых графиков и оптимистичные UI-обновления. Последний зафиксированный TTFB в `PERF_REPORT.md`: медиана около 127 мс после оптимизации; повторный production-замер после последних коммитов не выполнен.
