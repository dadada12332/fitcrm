---
id: TASK-0030
type: feature
status: completed
priority: P1
module: telegram-inbox
created: 2026-07-21
updated: 2026-07-21
owner: unassigned
tags: [fitcrm, task]
---

# Клиентские обращения из Telegram Mini App в CRM

## Goal

Клиент клуба пишет администратору из Telegram Mini App, а сотрудник принимает, назначает, обрабатывает и закрывает обращение в отдельном CRM inbox с доставкой ответа обратно через клубного бота.

## Reason

Mini App уже является клиентским кабинетом, но до задачи клиент не мог обратиться в свой клуб, а CRM не имела отдельного от платформенной поддержки рабочего места для таких сообщений.

## Requirements

- Идентифицировать клиента только через подтверждённую связь `(club_id, telegram_id) -> client_id`.
- Сохранить диалоги, сообщения, per-staff read state, ответственного и шаблоны ответов в tenant-scoped таблицах.
- Добавить CRM-раздел «Обращения» с адаптивными list/thread/context режимами.
- Добавить Mini App flow выбора темы, отправки, истории, переоткрытия и создания нового обращения.
- Доставлять ответы через бота клуба с retry cron; не смешивать обращения с `support_*` платформы.
- Добавить модульные права `inbox` и непрочитанный badge.

## Acceptance criteria

- [x] Клиентское сообщение из подписанного Mini App появляется в CRM по внутреннему `client_id`.
- [x] Сотрудник может ответить, назначить ответственного, сменить статус и использовать шаблон.
- [x] Telegram delivery хранит состояния pending/sent/failed и поддерживает повтор.
- [x] Mobile CRM начинает со списка и возвращается из диалога без потери состояния.
- [x] Таблицы недоступны authenticated для прямых записей; Server Actions проверяют permissions.
- [x] TypeScript, unit/security, E2E, build и browser QA пройдены.

## Files and data

- Files: `src/app/(app)/inbox/`, `src/components/app/ClientInbox.tsx`, `src/lib/client-inbox.ts`, `src/lib/telegram/client-support.ts`, Mini App API/UI, sidebar/permissions.
- Tables/RPC: `client_conversations`, `client_conversation_messages`, `client_conversation_reads`, `client_reply_templates`, `get_client_inbox_list`, `get_client_inbox_detail`, `get_sidebar_stats`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Реализован отдельный channel-agnostic inbox с первым каналом Telegram, защищённым Mini App API, CRM workflow, шаблонами, realtime обновлением и Supabase Cron retry. List/detail сведены в агрегированные RPC для сокращения сетевых round trips.

## Verification

- `npx eslint` по изменённым TS/TSX — passed.
- `npx tsc --noEmit` — passed.
- `npm run test:security` — 111 passed.
- `npm test` — 111 passed, 1 skipped.
- `npm run test:e2e` — passed; authenticated suites пропускаются без QA credentials.
- `npm run build` — passed.
- Browser QA localhost: desktop/mobile list, thread, back, templates, reply/failure state; console errors отсутствуют.
- Production Telegram delivery и deploy проверяются после push.

## Remaining

После появления Instagram messaging расширить существующий `channel`, не создавать второй inbox.

## Blockers

Нет.
