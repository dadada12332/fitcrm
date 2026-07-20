---
id: TASK-0027
type: feature
status: completed
priority: P1
module: retention
created: 2026-07-20
updated: 2026-07-20
owner: codex
tags: [fitcrm, task, retention, telegram, workflow]
---

# Контакты и результаты удержания

## Goal

Превратить AI-разбор удержания в законченный рабочий сценарий: сотрудник редактирует сообщение, связывается с клиентом, фиксирует результат и видит историю, а CRM автоматически подтверждает возврат после оплаты или посещения.

## Reason

Копирование черновика без следующего шага не даёт CRM понять, был ли контакт и вернулся ли клиент. Нужна измеримая воронка удержания без WhatsApp.

## Requirements

- Каналы: Telegram через бота клуба, телефон и копирование как резерв; WhatsApp не используется.
- Telegram отправляется только после явного подтверждения и только привязанному клиенту.
- Каждый контакт и результат сохраняются с `club_id`, CRM `client_id`, сотрудником и временем.
- Результаты: не ответил, заинтересован, продлевает, вернулся, отказался, связаться позже.
- Для повторного контакта сохраняется будущая дата.
- Оплаченная транзакция или визит автоматически закрывают активный кейс как успешный.

## Acceptance criteria

- [x] AI-черновик можно изменить без потери текста после обновления истории.
- [x] Telegram, звонок и копирование доступны в одном drawer без вложенной модалки.
- [x] Telegram имеет inline-подтверждение и понятное недоступное состояние.
- [x] Результат и follow-up сохраняются в CRM и отображаются в истории.
- [x] Автозакрытие по оплате и визиту проверено транзакционным тестом с rollback.
- [x] Полный E2E и production smoke пройдены после деплоя.

## Files and data

- Files: `src/app/(app)/retention/actions.ts`, `src/components/app/RetentionAiDrawer.tsx`, `src/components/app/RetentionCenter.tsx`, `src/lib/retention-ai.ts`, `src/components/ui/textarea.tsx`.
- Tables/RPC: `retention_cases`, `client_interactions`; триггеры на `payments` и `visits`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Реализованы Server Actions, UI контакта и результата, RLS-схема истории, индексы и автоматическое закрытие кейсов.

## Verification

- `npm run lint` — успешно.
- `npx tsc --noEmit` — успешно.
- `npm test` — 111 passed, 1 skipped.
- `npm run test:e2e` — 38/38 desktop/mobile.
- `npm run build` — успешно.
- Supabase: миграции применены; payment/visit triggers проверены транзакционно с rollback; новый FK index warning устранён.
- Production: deployment `dpl_Ao7qr6eUKVzK1H8Axt2d5gkVnx6x` Ready; 4/4 retention E2E на `fitcrm-three.vercel.app`.

## Remaining

Нет. Синтетические QA club/user удалены после production-проверки.

## Blockers

Нет.
