---
id: TASK-0033
type: feature
status: completed
priority: P2
module: telegram
created: 2026-07-22
updated: 2026-07-22
owner: unassigned
tags: [fitcrm, task]
---

# Редизайн шаблонов сообщений Telegram

## Goal

Сделать настройку автоматических Telegram-сообщений понятной сотруднику без знания технических переменных и сразу показывать фактический вид сообщения клиента.

## Reason

Старый экран показывал три одинаковых textarea без сценариев, допустимых переменных, предпросмотра и защиты от случайной потери изменений.

## Requirements

- Разделить шаблоны по событиям и объяснить момент отправки.
- Добавить контекстные переменные с вставкой в позицию курсора.
- Показать live preview с тестовыми данными.
- Поддержать reset, dirty state, character limit и неизвестные переменные.
- Не допустить рассинхрон между automation toggles и текстами шаблонов.
- Сохранить desktop/mobile и light/dark совместимость.

## Acceptance criteria

- [x] Три сценария имеют отдельные описания и наборы переменных.
- [x] Предпросмотр обновляется во время ввода.
- [x] Несохранённые изменения видны, стандартный текст восстанавливается одной кнопкой.
- [x] Клиент и сервер отклоняют пустые, слишком длинные и неизвестные переменные.
- [x] Production UI проверен без overflow и browser errors.

## Files and data

- Files: `src/components/app/TelegramTemplatesEditor.tsx`, `src/components/app/IntegrationManage.tsx`, `src/app/(app)/integrations/actions.ts`, `src/lib/telegram/bot.ts`.
- Tables/RPC: `clubs.settings.tg_settings`; схема БД не изменялась.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Добавлен трёхколоночный редактор: сценарии, текст/переменные и Telegram preview.
- На mobile секции складываются вертикально без горизонтального скролла.
- Automation и templates переведены на единое локальное состояние.
- Save защищён permission check и серверной валидацией Telegram limit/variables.
- Приветствие отправляется как надёжный plain text без хрупкого Markdown parsing.

## Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm test` — 126 passed, 1 skipped.
- `npm run build` — passed, 59 routes.
- Local browser QA: выбор сценариев, вставка переменной, dirty state, reset, unknown-variable validation; light/dark и desktop/mobile; overflow `0`, browser errors `0`.
- Production deployment `fitcrm-qtrfnchkx-crm228.vercel.app` — Ready; alias `fitcrm-three.vercel.app` обновлён.
- Production browser QA: редактор и preview доступны, overflow `0`, browser errors `0`.

## Remaining

Нет.

## Blockers

Нет.
