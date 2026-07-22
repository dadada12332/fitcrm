---
id: TASK-0043
type: feature
status: completed
priority: P1
module: pricing
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Включить реальные тарифные доступы и лимиты

## Goal

Сделать настройки тарифов из Platform Admin фактическим источником доступа CRM: разделы, функции и лимиты меняют UI, Server Actions и cron-сценарии без нового deploy.

## Reason

Раньше тарифы были витриной: их switches и limits сохранялись в БД, но CRM почти нигде их не применяла. Это создавало рассинхрон продаж, интерфейса и backend.

## Requirements

- Пересекать права роли с доступом тарифа, не расширяя права сотрудника.
- Скрывать выключенные разделы и блокировать прямые Server Actions.
- Применять лимиты клиентов, сотрудников, филиалов, товаров, ролей, интеграций, AI, Telegram, импортов и экспортов.
- Синхронизировать scheduled broadcasts и Telegram reminders с тарифом.
- Оставить в матрице только готовые функции продукта.

## Acceptance criteria

- [x] Изменения функций/разделов в Platform Admin применяются после следующего запроса CRM.
- [x] Месячные лимиты расхода резервируются атомарно.
- [x] Production migration применена и матрица четырёх тарифов проверена запросом.
- [x] TypeScript, 130 tests, production build и browser smoke прошли.

## Files and data

- Files: `src/lib/plan-access.ts`, `src/lib/plan-enforcement.ts`, `src/lib/club.ts`, CRM routes/actions, Telegram cron routes.
- Tables/RPC: `plans`, `plan_features`, `plan_sections`, `plan_limits`, `plan_usage`, `consume_plan_usage`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Добавлен единый resolver тарифа через связь клуба с планом; права роли пересекаются с sections/features. UI и прямые server mutations используют один результат. Настроена рабочая матрица Trial/Starter/Standard/Business, лимиты и cron enforcement. `clubs.plan_id` автоматически синхронизируется с `clubs.plan`.

## Verification

`npx tsc --noEmit`; `npm test` — 130 passed, 1 skipped; `npm run build` — 59 routes; localhost dashboard/integrations — 200, overflow 0, console errors 0. Production Supabase migrations 0076–0078 applied; матрица проверена read-only запросом. Vercel deployment `dpl_PVT2ruGX9jtKEYcXkXVrevB4q4t4` — READY; `fitcrm-three.vercel.app` назначен на новую сборку; `/api/health` вернул `status: ok`, database reachable.

## Remaining

Platform Admin UI не проверен браузером из-за отсутствия platform-admin роли в текущей QA-сессии; backend сохранения и production data проверены тестами и запросом.

## Blockers

Нет.
