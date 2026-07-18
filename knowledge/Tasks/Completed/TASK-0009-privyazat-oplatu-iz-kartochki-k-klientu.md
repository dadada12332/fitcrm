---
id: TASK-0009
type: bug
status: completed
priority: P1
module: payments
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, task]
---

# Привязать оплату из карточки к клиенту

## Goal

Оплата, открытая из карточки клиента, всегда создаётся для этого клиента и не предлагает повторно выбирать получателя.

## Reason

Повторный выбор клиента внутри его карточки создавал лишний шаг и позволял случайно записать оплату другому человеку.

## Requirements

- Передавать клиента из карточки в общий дровер как фиксированный контекст.
- Не показывать поиск и возможность смены клиента в этом контексте.
- Сохранить поиск клиента в глобальном сценарии создания оплаты.
- Проверять tenant scope клиента и абонемента перед созданием обычной и онлайн-оплаты.
- Обновлять карточку после закрытия дровера.

## Acceptance criteria

- [x] В карточке отображается текущий клиент без кнопки сброса и поиска.
- [x] Платёж отправляет `client.id` открытой карточки.
- [x] Глобальный дровер оплат по-прежнему позволяет искать клиента.
- [x] Чужой клиент или абонемент отклоняется Server Action.
- [x] TypeScript, ESLint, Vitest и production build проходят.

## Files and data

- Files: `src/components/app/NewPaymentModal.tsx`, `src/components/app/ClientProfileCard.tsx`, `src/app/(app)/payments/actions.ts`.
- Tables/RPC: `clients`, `memberships`, `subscriptions`, `payments`; миграции не требуются.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

- Добавлен опциональный `fixedClient` для контекстного запуска общего дровера оплаты.
- Карточка клиента передаёт собственные `id`, имя и телефон и обновляется после закрытия.
- Server Actions валидируют принадлежность клиента и абонемента текущему клубу.
- Маршрут карточки клиента ревалидируется после обычной и онлайн-оплаты.

## Verification

- `npx eslint src/components/app/NewPaymentModal.tsx src/components/app/ClientProfileCard.tsx 'src/app/(app)/payments/actions.ts'`
- `npx tsc --noEmit`
- `npm test`: 85 passed, 1 skipped.
- `npm run build`: успешно, Next.js 16.2.7.
- Production deployment `dpl_42MtMJTDNHgLQYSzLihvg7N5M5G2`: `READY`, alias `fitcrm-three.vercel.app` подтверждён.
- Авторизованный browser smoke: карточка Амира Тураева показывает фиксированный блок клиента; поле `Имя или телефон...` отсутствует; console errors отсутствуют.

## Remaining

Нет.

## Blockers

Нет.
