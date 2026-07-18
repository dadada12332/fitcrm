---
id: TASK-0022
type: feature
status: review
priority: P1
module: retention
created: 2026-07-19
updated: 2026-07-19
owner: codex
tags: [fitcrm, task, retention, research]
---

# Центр удержания клиентов и предотвращения оттока

## Goal

Дать владельцу клуба локально проверяемую очередь клиентов с риском оттока, причинами риска, приоритетом и прямым переходом к действию без изменения production и схемы БД.

## Reason

Конкурентный анализ показал, что сильные fitness CRM объединяют продажи, удержание и автоматические действия. В FitCRM уже есть данные об абонементах, посещениях и долгах, но они не собраны в одну рабочую очередь.

## Requirements

- Новый раздел `Удержание` в sidebar для ролей с `reports.view` и `clients.view`.
- Детерминированная оценка риска по сроку абонемента, отсутствию посещений, долгу, заморозке и недавнему истечению.
- KPI, поиск, фильтры и переходы к карточке клиента, продлениям и AI.
- Адаптивная desktop/mobile верстка на дизайн-токенах.
- Никаких production deploy, миграций и клиентских персональных данных.

## Acceptance criteria

- [x] Очередь формируется из существующих данных под RLS и сортируется по риску.
- [x] Фильтры `Критические`, `Продление`, `Неактивные`, `Долги`, `Вернуть` работают.
- [x] Маршрут и навигация доступны только при нужных permissions.
- [x] Страница проверена на localhost авторизованным синтетическим QA-пользователем в desktop/mobile и light/dark режимах.
- [x] TypeScript, unit, полный Playwright e2e и production build проходят.
- [ ] Владелец проверил продуктовую полезность и пороги риска.

## Files and data

- Files: `src/app/(app)/retention/page.tsx`, `src/components/app/RetentionCenter.tsx`, `src/lib/retention.ts`, sidebar, breadcrumbs, client profile, unit tests.
- Tables/RPC: только чтение существующего client export RPC и membership prices; новых миграций нет.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Добавлен локальный Beta-раздел `Удержание` с четырьмя KPI и приоритизированной очередью.
- Добавлено чистое scoring-ядро с unit-тестами.
- Исправлено падение карточки клиента на localhost при отсутствии service-role ключа: service-only Telegram identity теперь деградирует в `null`, не ослабляя RLS.
- Подготовлен сравнительный обзор global и Central Asia решений.

## Verification

- `npx tsc --noEmit` — успешно.
- `npm test` — 101 passed, 1 skipped.
- `npm run test:e2e` — 30 passed в desktop/mobile Chromium.
- `npm run build` — успешно, маршрут `/retention` собран.
- Scoped ESLint измененных файлов — успешно.
- Авторизованный localhost smoke — успешно; framework overlay, browser errors и horizontal overflow отсутствуют.

## Remaining

- Продуктовая проверка владельцем и калибровка порогов на обезличенной статистике клуба.
- После одобрения — отдельное решение о production deploy.
- Следующий архитектурный кандидат: полноценная воронка лидов с owner, next action, source conversion и loss reasons; потребуется отдельная схема БД.

## Blockers

Нет технического blocker. Production намеренно не изменен по запросу владельца.
