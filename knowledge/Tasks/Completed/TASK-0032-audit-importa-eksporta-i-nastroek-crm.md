---
id: TASK-0032
type: feature
status: completed
priority: P1
module: crm
created: 2026-07-21
updated: 2026-07-21
owner: unassigned
tags: [fitcrm, task]
---

# Аудит импорта экспорта и настроек CRM

## Goal

Сделать импорт клиентов и все пользовательские экспорты CRM предсказуемыми, безопасными и читаемыми, а в настройках оставить только реально работающие сценарии.

## Reason

Перед массовым запуском нужно исключить потерю данных при миграции, CSV-injection, нечитаемые отчёты и настройки-заглушки.

## Requirements

- Проверить импорт клиентов на CSV/XLSX, разных разделителях, заголовках, дублях и неполных строках.
- Все экспорты уважают фильтры, tenant scope и granular permissions.
- CSV открывается в Excel с кириллицей и защищён от spreadsheet formulas.
- Отчёты выгружаются одним читаемым XLSX с листами, freeze panes, filters и корректными ширинами.
- Видимые фильтры и кнопки имеют реальное действие.
- Каждая настройка сохраняется, валидируется и используется связанным функционалом; нереализованные обещания не показываются как рабочие.

## Acceptance criteria

- [x] Юнит-тесты импорта и экспорта проходят.
- [x] Все экспорты формируются через общий безопасный слой и имеют понятные имена файлов/листов.
- [x] Права export проверяются на сервере там, где экспорт получает скрытые серверные данные.
- [x] Настройки пройдены по табам; заглушки удалены/заменены.
- [x] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` проходят.
- [x] Ключевые flow проверены в browser QA на desktop и mobile.

## Files and data

- Files: `src/lib/csv.ts`, export routes/actions/buttons, `src/components/app/ClubSettings.tsx`, settings actions.
- Tables/RPC: `clubs.settings`, `payments`, `clients`, `memberships`, `subscriptions`, `telegram_integrations`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Проведена инвентаризация. Найдены пять разных CSV-реализаций, два неподключённых XLSX-route, недостающая проверка `payments.export`, экспорт абонементов в мёртвом компоненте и несколько настроек-заглушек.

- Добавлен единый CSV serializer с BOM, корректным quoting и защитой от spreadsheet formula injection.
- XLSX отчётов, dashboard и шаблона импорта получили читаемые заголовки, ширины, фильтры, freeze panes и печатные настройки.
- Экспорты клиентов, оплат, абонементов и транзакций переведены на общий download layer; отчёты выгружаются одним XLSX.
- Импорт CSV/XLSX распознаёт разные заголовки/разделители, нормализует значения, обрабатывает дубли и сохраняет неподдержанные поля в `clients.import_data`.
- Рабочие часы, методы оплаты и Telegram-напоминания сохраняются в реально потребляемые настройки.
- Безопасность требует текущий пароль и умеет завершать остальные сессии; интеграционные настройки ведут в полноценные модули.
- Удалены неработающие фильтры, фиктивные SMS/email/2FA/финансовые параметры и legacy export/print компоненты.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm test` — 16 файлов passed, 1 skipped; 126 тестов passed, 1 skipped.
- Focused import/export tests — 15 passed до финального cleanup; повторный набор import/export — 9 passed.
- `npm run build` — passed, 59 страниц сгенерировано.
- Browser QA production: clients/payments CSV actions показали success toast; memberships export присутствует и выполняется; reports/dashboard XLSX controls присутствуют.
- Все девять вкладок settings открыты в production без application error; проверены реальные labels/actions и отсутствие удалённых заглушек.
- Desktop/mobile browser QA для основных data pages и settings: горизонтальный overflow `0`.
- Production deployment `dpl_FnB4MpBqFdjvMs3W1cYJHffehKRy` — `READY`; alias `fitcrm-three.vercel.app` подтверждён.

## Remaining

Физический выбор локального файла через системный file picker не удалось автоматизировать из Browser runtime. Полный parser/mapping/import pipeline покрыт unit-тестами; production UI мастера и XLSX-шаблон проверены отдельно.

## Blockers

Нет.
