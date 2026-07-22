---
id: TASK-0041
type: feature
status: completed
priority: P3
module: marketing
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Актуализировать FAQ лендинга

## Goal

FAQ лендинга описывает только фактически работающие сценарии FitCRM и одинаково актуален на русском, английском и узбекском языках.

## Reason

В FAQ оставались неподтверждённые обещания о бесплатном тарифе после trial, Visa/Mastercard, полном audit trail и публичном REST API.

## Requirements

- Сверить продуктовые утверждения с кодом, миграциями и текущими настройками CRM.
- Убрать неподтверждённые возможности и заменить их реальными сценариями.
- Синхронно обновить RU, EN и UZ.

## Acceptance criteria

- [x] В FAQ нет обещания бесплатного тарифа после окончания trial.
- [x] Способ оформления подписки соответствует текущей заявке и ручной активации.
- [x] Удалены неподтверждённые публичный REST API, Visa/Mastercard и полный audit trail.
- [x] Импорт, роли, платежи и Telegram описаны по фактической реализации.
- [x] TypeScript, tests и production build проходят.
- [x] FAQ проверен визуально на desktop и mobile.

## Files and data

- Files: `src/lib/i18n/messages.ts`.
- Tables/RPC: без изменений.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Обновлены десять вопросов и ответов на каждом из трёх языков. Удалены маркетинговые обещания, не подтверждённые текущим продуктом; добавлены точные сценарии trial, подписки, клиентских оплат, импорта и Telegram Mini App.

## Verification

- `npx tsc --noEmit` — passed.
- `npm test -- --run` — 126 passed, 1 skipped.
- `npx eslint src/lib/i18n/messages.ts` — passed.
- `npm run build` — passed.
- Browser QA: desktop 1280×720 и mobile 390×844; ответы раскрываются, горизонтального overflow нет.

## Remaining

Нет.

## Blockers

Нет.
