---
id: TASK-0023
type: feature
status: completed
priority: P1
module: growth
created: 2026-07-19
updated: 2026-07-19
owner: codex
tags: [fitcrm, task, growth, research]
---

# Growth OS и ежедневный центр роста

## Goal

Собрать на отдельной localhost-ветке связанный набор из 5–10 рабочих инструментов, которые помогают владельцу клуба ежедневно находить и оценивать точки роста без изменения production и схемы БД.

## Reason

Конкурентные продукты развивают автоматизацию, prediction и lifecycle engagement, но владельцу клуба по-прежнему приходится переводить аналитику в действия вручную. FitCRM может объединить сигналы, следующий шаг и прогноз эффекта в одном human-in-the-loop экране.

## Requirements

- Использовать существующие tenant-scoped данные dashboard и retention.
- Дать ежедневный план, health score, радар возможностей, симулятор, playbooks и каталог экспериментов.
- Не отправлять сообщения и не мутировать клиентские данные без отдельного подтвержденного workflow.
- Только дизайн-токены, desktop/mobile, light/dark.
- Production и общую схему БД не изменять.

## Acceptance criteria

- [x] Реализовано не менее пяти связанных рабочих возможностей.
- [x] Расчеты детерминированы и покрыты unit-тестами.
- [x] Основные интерактивные сценарии проверены на localhost.
- [x] TypeScript, scoped lint, unit, e2e и build проверены.
- [x] Владелец получил готовую ветку для review и одобрил выпуск в production.

## Files and data

- Files: `src/app/(app)/growth/page.tsx`, `src/lib/growth.ts`, четыре Growth UI-компонента, sidebar, breadcrumbs и unit-тесты.
- Tables/RPC: только существующие read-only dashboard/client/membership данные.

## Must not break

Tenant isolation, auth, permissions, существующие CRM-маршруты и production.

## Changes

- Добавлен маршрут `Growth OS` с permission gate и read-only tenant-scoped загрузкой данных.
- Реализованы: пульс клуба, ежедневный план, revenue opportunity radar, приоритизация, what-if симулятор, четыре playbook-сценария, пять growth-экспериментов и human-in-the-loop guardrail.
- Симулятор связывает конверсии продления, win-back, collection и referral с текущими денежными пулами.
- Эксперимент открывает связанный playbook; текст можно копировать, но автоматической отправки нет.
- Стрелки ежедневного плана больше не уводят пользователя в другие CRM-разделы: они остаются в `/growth`, открывают вкладку `Playbooks` или `Эксперименты` и выбирают подходящий сценарий.

## Verification

- `npx tsc --noEmit` — успешно.
- Scoped ESLint измененных файлов — успешно.
- `npm test` — 105 passed, 1 skipped.
- `npm run test:e2e` — 30 passed в desktop/mobile Chromium.
- `npm run build` — успешно, `/growth` собран.
- Авторизованный localhost browser gate — desktop/mobile, light/dark, simulator recalculation, copy playbook и experiment-to-playbook flow; errors/overlay/overflow отсутствуют.
- Повторная проверка после исправления навигации: TypeScript, scoped ESLint, 105 unit tests, 30 E2E tests и production build — успешно; клик «Запустить возврат клиентов» оставляет URL `/growth`, выбирает `Playbooks` и сценарий «Мягкое возвращение».
- Production browser gate на синтетическом клубе: `/growth` открыт с активной сессией; стрелка остаётся на `/growth`, `aria-selected` вкладки `Playbooks` равно `true`, выбран сценарий «Мягкое возвращение», console errors отсутствуют.

## Deploy

- Merge commit: `0514d3d` (`Release retention center and Growth OS`).
- Vercel deployment: `dpl_8Kye9UKe6VGpHWSmaoAb7byuUkks`, target `production`, status `READY`, function region `syd1`.
- Aliases: `https://fitcrm-three.vercel.app`, `https://fitcrm-crm228.vercel.app`, `https://fitcrm-git-main-crm228.vercel.app`.
- `/login` отвечает HTTP 200; анонимный `/growth` отвечает HTTP 307 и переводит на `/login`.
- Runtime error logs и HTTP 500 после production smoke не обнаружены.

## Remaining

- Калибровка health/scenario assumptions на обезличенной статистике.
- Persistence экспериментов и lead pipeline требуют отдельных продуктовых задач.

## Blockers

Нет.
