---
id: TASK-0025
type: feature
status: completed
priority: P1
module: platform
created: 2026-07-20
updated: 2026-07-20
owner: codex
tags: [fitcrm, task]
---

# Production performance and quality hardening

## Goal

Снизить задержки ключевых CRM-экранов, убрать подтверждённые React/runtime дефекты и расширить автоматический release gate без внешних credentials.

## Reason

Launch audit подтвердил controlled-beta readiness, но выявил 1.6–2.7 с warm navigation, lint/runtime debt и недостаточное покрытие авторизованных сценариев.

## Requirements

- Оптимизировать settings, reports, staff и общий app shell по измеренным bottleneck.
- Исправить React/ESLint ошибки с реальным runtime/performance риском.
- Убрать Recharts warnings и начать миграцию raw colors в затронутых компонентах.
- Добавить базовую observability инфраструктуру без внешнего vendor lock-in.
- Расширить Playwright release gate для авторизованных сценариев.

## Acceptance criteria

- [x] TypeScript, unit/security tests, build и E2E проходят.
- [x] Основные authenticated routes не имеют browser errors/overflow.
- [x] Подтверждённые slow-path waterfalls сокращены и измерены.
- [x] Knowledge и Obsidian синхронизированы, production deployment проверен.

## Files and data

- Files: app shell, settings, staff, reports, charts, shared CRM components, health route, instrumentation и release tests.
- Tables/RPC: `get_staff_page_data`, migration `0068_staff_page_aggregate.sql`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Убраны последовательные запросы на settings и staff; staff aggregate перенесён в один scoped RPC.
- Устранены React purity/cascade warnings, удалён dead UI code, явные `any` сведены к нулю.
- Recharts получили стабильные начальные размеры, затронутые UI-цвета переведены на дизайн-токены.
- Добавлены публичный `/api/health`, структурированные request-error logs и фильтрация штатных abort событий.
- Добавлен authenticated Playwright gate по 12 основным CRM-маршрутам на desktop и mobile.

## Verification

- `npx eslint .` — 0 errors, 0 warnings.
- `npx tsc --noEmit` — успешно.
- `npm test` — 107 passed, 1 skipped.
- `npm run test:e2e` — 34 passed на desktop/mobile.
- Production `npm run test:e2e` на `fitcrm-three.vercel.app` — 34 passed на desktop/mobile.
- `npm run build` — успешно, 58 static pages.
- Supabase Security и Performance Advisors — 0 замечаний после migration 0068.
- Vercel deployment `dpl_DMJquHdRWL4xHrRgisrnoqtLyW1c` — READY, production alias проверен.

## Remaining

Нет. Disposable QA club/user удалены после production-проверки.

## Blockers

Нет.
