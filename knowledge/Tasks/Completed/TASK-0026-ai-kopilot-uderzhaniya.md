---
id: TASK-0026
type: feature
status: completed
priority: P1
module: retention
created: 2026-07-20
updated: 2026-07-20
owner: codex
tags: [fitcrm, task]
---

# AI-копилот удержания

## Goal

Сделать contextual AI-разбор удержания без перехода в общий AI-раздел: общий сегмент и отдельный клиент анализируются внутри retention drawer.

## Reason

Текущая кнопка теряет контекст и ведёт на `/ai`, поэтому пользователь не получает решения по очереди удержания.

## Requirements

- Сервер повторно загружает данные по текущему `club_id`; входные client IDs не считаются доверенными.
- Общий разбор содержит диагноз, драйверы риска, приоритетную очередь и план на 7 дней.
- Разбор клиента содержит факты, рекомендацию и персональный черновик сообщения.
- AI остаётся read-only: отправка сообщений и изменение CRM выполняются только отдельными подтверждёнными действиями.
- При недоступном AI provider работает детерминированный fallback по CRM-данным.

## Acceptance criteria

- [x] Кнопка «Разобрать с AI» открывает drawer и сохраняет текущий retention filter.
- [x] У каждого кандидата доступен клиентский AI-разбор.
- [x] Tenant/permissions проверки и ограничение входных данных покрыты тестами.
- [x] Desktop/mobile, TypeScript, lint, tests и production build проходят.

## Files and data

- Files: retention page/actions, `RetentionCenter`, новый AI drawer и pure retention analysis library.
- Tables/RPC: read-only `clients`, `memberships`, `visits`, `payments`, `subscriptions`; новых таблиц нет.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Добавлен защищённый `analyzeRetentionAction` с Zod validation, permission checks и обязательным `club_id` scope.
- Общий разбор показывает причины риска, KPI, приоритетных клиентов и план на 7 дней.
- Клиентский разбор показывает CRM-факты, персональную рекомендацию и копируемый черновик сообщения.
- Gemini улучшает формулировки, но не может подменить client ID или добавить неизвестного клиента; при ошибке работает rules fallback.
- Действия read-only: сообщения не отправляются и CRM-данные не изменяются.

## Verification

- `npx eslint .` — 0 errors, 0 warnings.
- `npx tsc --noEmit` — успешно.
- `npm test` — 111 passed, 1 skipped.
- `npm run test:e2e` — 36 passed, включая retention AI на desktop/mobile.
- `npm run build` — успешно.
- Визуально проверены desktop 1280×720 и Pixel 7 без переполнения drawer.
- Production E2E на `fitcrm-three.vercel.app` — 2/2 desktop/mobile retention AI scenarios.
- Vercel deployment `dpl_Fp4VbYbWGUy9KNrQHEBjEQxkd72s` — READY.

## Remaining

Нет. Disposable QA club/user удалены после production-проверки.

## Blockers

Нет.
