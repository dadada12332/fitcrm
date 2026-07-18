---
id: TASK-0010
type: bug
status: completed
priority: P1
module: settings
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, task]
---

# Исправить бесконечную загрузку ролей и прав

## Goal

Вкладка «Роли и права» завершает загрузку и показывает роли либо понятную ошибку с повтором.

## Reason

При переходе на вкладку из настроек интерфейс навсегда оставался в состоянии skeleton.

## Requirements

- Устранить самоперезапуск эффекта загрузки ролей.
- Гарантированно выключать skeleton после ответа или ошибки.
- Сохранить lazy loading при переходе между вкладками.
- Показывать ошибки RPC и запросов Supabase.
- Передавать ошибку server-rendered маршрута `/settings/roles` в интерфейс.

## Acceptance criteria

- [x] `rolesLoading` не отменяет собственный запрос через dependency cleanup.
- [x] Загрузка включается при клике и повторной попытке.
- [x] Ошибки загрузки отображаются вместо пустого экрана.
- [x] ESLint, TypeScript, Vitest и production build проходят.
- [x] Production browser smoke после deploy.

## Files and data

- Files: `src/app/(app)/settings/SettingsShell.tsx`, `SettingsView.tsx`, `roles/actions.ts`.
- Tables/RPC: `club_roles`, `staff`, `create_default_club_roles`; миграции не требуются.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Убрана циклическая зависимость эффекта от `rolesLoading`.
- Loading state перенесён в обработчики клика и повтора.
- Ошибки RPC и обоих select-запросов теперь возвращаются в UI.
- Ошибка прямого server-rendered маршрута передаётся в `SettingsShell`.

## Verification

- ESLint по изменённым файлам: успешно.
- `npx tsc --noEmit`: успешно.
- `npm test`: 85 passed, 1 skipped.
- `npm run build`: успешно, Next.js 16.2.7.
- Production deployment `dpl_6RLyxkxALBkmiVS2BGYSwnpMvRqA`: `READY`, alias подтверждён.
- Авторизованный browser smoke: переход кликом и прямой `/settings/roles` показывают 6 ролей; console errors отсутствуют.

## Remaining

Нет.

## Blockers

Нет.
