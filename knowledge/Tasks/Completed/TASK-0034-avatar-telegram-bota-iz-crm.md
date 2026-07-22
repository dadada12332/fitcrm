---
id: TASK-0034
type: feature
status: completed
priority: P2
module: integrations
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Аватар Telegram-бота из CRM

## Goal

Владелец клуба может установить, заменить и удалить аватар Telegram-бота прямо из CRM.

## Reason

Брендинг подключённого бота должен настраиваться в том же интерфейсе, что и остальные параметры Telegram-интеграции, без ручного перехода в BotFather.

## Requirements

- Принимать JPG, PNG и WebP до 5 МБ.
- На сервере приводить изображение к квадратному JPG 512x512 перед отправкой в Telegram.
- Не передавать bot token в браузер и проверять право `telegram.manage`.
- Хранить безопасный URL предпросмотра в настройках клуба и очищать его при удалении/отключении.

## Acceptance criteria

- [x] Аватар можно загрузить, заменить и удалить из вкладки «Основное».
- [x] Изображение обновляется через официальный Telegram Bot API.
- [x] UI показывает актуальный предпросмотр и понятную обратную связь.
- [x] TypeScript, lint, тесты и production build проходят.

## Files and data

- Files: `src/app/(app)/integrations/actions.ts`, `src/components/app/IntegrationManage.tsx`, `src/app/(app)/integrations/[slug]/page.tsx`.
- Tables/RPC: `clubs.settings.tg_bot`, bucket `avatars`; миграция не требуется.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Добавлены tenant-scoped Server Actions для установки и удаления profile photo бота.
- Изображение валидируется и преобразуется через `sharp` в статический JPEG 512x512.
- Добавлен адаптивный блок управления аватаром с preview, replace/remove и feedback.
- URL предпросмотра хранится в `clubs.settings.tg_bot`; обновление токена его сохраняет, disconnect очищает файл.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm test` — 126 passed, 1 skipped.
- `npm run build` — passed.
- Runtime image probe — PNG 800x400 успешно преобразован в JPEG 512x512.
- Local `/integrations/telegram` — экран без подключённого бота проверен в QA-клубе; реальный вызов смены avatar не выполнялся без пользовательского изображения.

## Remaining

Production deploy и проверка alias.

## Blockers

Нет.
