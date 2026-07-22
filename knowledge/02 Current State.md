---
type: current-state
status: active
updated: 2026-07-22
tags: [fitcrm, operations]
---

# Current State

## Git и runtime

<!-- AUTO:START repository-state -->
- Версия package: `0.1.0`.
- Branch: `main`.
- Последний commit: 26331e9 · 2026-07-22T14:38:07+05:00 · fix: align landing FAQ with product.
- Working tree: есть незакоммиченные изменения.
- Миграции в Git: 76; последняя `20260720154135_index_growth_experiment_creator.sql`.
- Последний production deploy: нет доступных подтверждённых данных.
<!-- AUTO:END repository-state -->

## Готовность модулей

**Работают:** auth и onboarding, dashboard, клиенты, абонементы, посещения, расписание, оплаты, склад, сотрудники, отчёты, настройки, Telegram, Payme/Click, поддержка и основные разделы Platform Admin. Импорт клиентов принимает CSV/XLSX с гибким mapping и сохраняет неподдержанные поля; CSV/XLSX-экспорты CRM унифицированы, защищены от formula injection и проверены на кириллице. Настройки клуба, финансов, Telegram-уведомлений, интеграций, безопасности, подписки, ролей, филиалов и сотрудников повторно проверены в production. Telegram templates имеют сценарный редактор с live preview, контекстными переменными и двойной валидацией; automation toggles и тексты сохраняются из одного состояния. Брендинг Telegram-бота позволяет установить, заменить и удалить аватар из CRM с серверным приведением к требованиям Bot API. Telegram Mini App и CRM имеют отдельный tenant-scoped inbox клиентских обращений с ответами, ответственными, статусами, шаблонами и retry доставки. Beta-раздел удержания и Growth OS выпущены в production и проверены на синтетическом QA-клубе; Growth-эксперименты сохраняют club-scoped lifecycle и результаты.

**Частично:** занятия/бронирования, audit trail UI и тарифные ограничения. Telegram automation работает для expiry/class reminders, broadcasts, QR и self-service renewal; recurring auto-charge требует отдельного provider API. AI-аналитика работает как read-only operational workspace с детерминированными KPI и LLM для свободных запросов.

**Не завершено или не подтверждено:** custom SMTP и реальные SMS, системный мониторинг ошибок, проверенный restore, staging-среда и provider-certified Payme/Click flow. Массовый запуск имеет статус NO-GO; controlled beta — GO. См. [[Reports/Launch Readiness 2026-07-20]].

## База данных

- В репозитории последовательные миграции `0001`–`0075` и отдельный timestamped index; launch hardening `0065`–`0067`, inbox `0074` и client import metadata `0075` применены к production.
- Bot tokens вынесены из публично читаемой `clubs` в service-only `telegram_integrations`; открытых `clubs.tg_token` в production — `0`.
- Supabase Cron обрабатывает scheduled broadcasts каждые 5 минут; Vercel daily cron отвечает за reminders/report.
- Supabase Cron каждые 10 минут повторяет pending/failed ответы клиентского inbox; сообщения остаются сохранёнными даже при временной недоступности Telegram.

См. [[Database/Database State]].

## Окружения

См. [[Infrastructure/Environment Matrix]]. Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы. Production deployment `dpl_FHqktTb9cQjXA55RF5kQFu1DQ39Z` имеет статус `READY`; alias `fitcrm-three.vercel.app` подтверждён. Актуализированный FAQ доступен на домене и проверен через production Browser smoke; Telegram KPI redesign, bot avatar release и binary preview repair также доступны в production. Template editor, импорт/экспорт и settings tabs ранее прошли production gate. Клиентский inbox проверен на localhost desktop/mobile и production delivery через реального клубного бота; `/growth` ранее проверен в синтетическом QA-клубе.

## Риски и долг

- Warm Supabase health-check составляет 55–167 ms, но зафиксирован cold sample 1162 ms; требуется наблюдение за cold path.
- RLS изолирует tenant, но права модулей зависят от корректности каждой Server Action.
- `npm audit --omit=dev` фиксирует 5 high, 6 moderate и 2 low advisory в основном в транзитивных зависимостях Next/shadcn/ExcelJS; предлагаемый автоматический fix требует несовместимых major-изменений и не применён без отдельной проверки.
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
