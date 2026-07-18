---
id: TASK-0008
type: bug
status: completed
priority: P1
module: cron-api
created: 2026-07-18
updated: 2026-07-18
owner: Codex
tags: [fitcrm, cron, api, auth]
---

# Восстановить доступ Vercel Cron к API

## Goal

Vercel Cron должен доходить до собственной Bearer authorization endpoint без редиректа CRM middleware.

## Reason

Production smoke после deploy показал `307 /login` для `/api/broadcasts/run`; Vercel Cron не имеет пользовательской auth cookie.

## Requirements

- Открыть middleware boundary только для `/api/broadcasts/*`.
- Сохранить обязательную проверку `CRON_SECRET` внутри route.
- Зафиксировать contract тестами для всех трёх cron endpoints.

## Acceptance criteria

- [x] Анонимный запрос получает `401 Unauthorized`, а не redirect.
- [x] Broadcast, reconcile и daily report проходят одинаковую server-to-server boundary.
- [x] Desktop/mobile E2E, TypeScript и production build проходят.

## Files and data

- Files: `src/lib/supabase/middleware.ts`, `tests/e2e/auth-and-routing.spec.ts`.
- Tables/RPC: без изменений.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

`/api/broadcasts` добавлен в middleware public paths; route-level secret остаётся обязательным.

## Verification

- Playwright: 26/26 passed, включая три API boundary test в desktop/mobile projects.
- `npx tsc --noEmit`: passed.
- Production build: passed, exit 0.
- Production deployment `dpl_DLjTNapR78aLzfXZnqJXQ8imieAS`: READY; `fitcrm-three.vercel.app` alias confirmed.
- Remote smoke: all three cron endpoints return `401 Unauthorized` without redirect; login/auth redirects also passed.

## Remaining

Нет.

## Blockers

Нет.
