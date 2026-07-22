---
id: TASK-0035
type: bug
status: completed
priority: P1
module: integrations
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Исправить повреждение аватара Telegram в CRM

## Goal

Загруженный avatar отображается одинаково в Telegram и CRM, без повреждения бинарного JPEG в Storage.

## Reason

Production upload успешно менял фото Telegram-бота, но preview-файл в Supabase начинался с UTF-8 replacement bytes и не декодировался браузером.

## Requirements

- Передавать JPEG в Supabase Storage как бинарный Blob, а не server Buffer.
- После upload скачивать объект service client и проверять JPEG signature.
- Восстановить уже повреждённый production preview из текущего profile photo Telegram.

## Acceptance criteria

- [x] Новый Storage object начинается с `FF D8 FF` и декодируется через Sharp/браузер.
- [x] CRM показывает тот же avatar, который установлен в Telegram.
- [x] TypeScript, lint, tests и build проходят.

## Files and data

- Files: `src/app/(app)/integrations/actions.ts`.
- Tables/RPC: bucket `avatars`, `clubs.settings.tg_bot`; миграция не нужна.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Причина подтверждена по production object: HTTP 200 `image/jpeg`, но сигнатура начиналась с `EF BF BD`, и Sharp отклонял файл как unsupported format.

- Storage upload переведён с server Buffer на стандартный Blob/Uint8Array.
- После upload Server Action повторно скачивает объект и проверяет JPEG signature; повреждённый preview удаляется и не сохраняется в settings.
- Существующий production preview восстановлен из текущего profile photo Telegram и получил новый cache-busting URL.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm test` — 126 passed, 1 skipped.
- `npm run build` — passed, 59 routes.
- Supabase regression probe — Blob upload/download, signature `FF D8 FF`, Sharp decode; временный объект удалён.
- Production repair — current bot photo downloaded through Telegram API, normalized to JPEG 512x512, uploaded and visually decoded.

## Remaining

Production deploy и alias verification.

## Blockers

Нет.
