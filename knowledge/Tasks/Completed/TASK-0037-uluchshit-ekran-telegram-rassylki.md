---
id: TASK-0037
type: feature
status: completed
priority: P2
module: integrations
created: 2026-07-22
updated: 2026-07-22
owner: codex
tags: [fitcrm, telegram, broadcast, design-system]
---

# Улучшить экран Telegram-рассылки

## Goal

Сделать экран Telegram-рассылки понятным, адаптивным и визуально единым с CRM, сохранив существующие сценарии отправки и планирования.

## Reason

Старая трёхколоночная компоновка сжимала редактор, отделяла настройки от основного действия и использовала неверное поле для ссылки на бота.

## Requirements

- Объединить аудиторию, время, редактор и действия в один последовательный сценарий.
- Оставить отдельный компактный предпросмотр и читаемую историю рассылок.
- Поддержать desktop/mobile, ручной выбор клиентов, переменные, emoji, изображение и тестовую отправку.
- Валидировать реальные ограничения Telegram и на клиенте, и в Server Actions.

## Acceptance criteria

- [x] Редактор не сжимается и не создаёт горизонтальный overflow на мобильном экране.
- [x] Ссылка на бота строится из Telegram username, а не display name.
- [x] Сообщения длиннее 4096 символов и подписи длиннее 1024 символов не отправляются.
- [x] Изображения ограничены поддерживаемыми MIME и размером 8 МБ.
- [x] Test, TypeScript, lint и production build проходят.

## Files and data

- Files: `src/components/app/TelegramBroadcast.tsx`, `src/components/app/IntegrationManage.tsx`, `src/app/(app)/integrations/actions.ts`.
- Tables/RPC: существующие `telegram_broadcasts`, `telegram_integrations`; миграций нет.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Экран переведён с трёх колонок на основную рабочую область и отдельный preview. Настройки получателей и времени встроены в форму, тестовая и основная отправки собраны в одном footer, история упрощена. Исправлена ссылка `t.me`, добавлены синхронные client/server ограничения Telegram.

## Verification

- Local browser QA: desktop 1280x720 и mobile 390x844, connected QA state.
- Проверены мгновенная/запланированная отправка, переменные, персонализация preview и limit state 4097/4096.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm test` — 126 passed, 1 skipped.
- `npm run build` — passed, 59 routes.

## Remaining

Нет.

## Blockers

Нет.
