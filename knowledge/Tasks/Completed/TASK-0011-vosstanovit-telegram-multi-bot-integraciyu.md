---
id: TASK-0011
type: feature
status: completed
priority: P1
module: integrations
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, task, telegram, security]
---

# Восстановить Telegram multi-bot интеграцию

## Goal

Сделать клубных Telegram-ботов реально входящими и исходящими, tenant-safe и наблюдаемыми.

## Reason

Токен сохранялся, но webhook клубного бота не регистрировался; входящие команды обслуживал один глобальный бот, а production не имел таблицы `broadcasts`.

## Requirements

- Webhook и телефонная привязка строго скоупятся по `club_id`.
- Рассылки и автоматические напоминания имеют историю и идемпотентность.
- Клиент получает абонемент, расписание, QR, настройки напоминаний и онлайн-продление.
- CRM сканирует клиентский QR на телефоне администратора.

## Acceptance criteria

- [x] У каждого подключённого клуба уникальный webhook и secret token.
- [x] Один Telegram ID может быть связан с несколькими клубными ботами.
- [x] Отложенные рассылки обрабатываются каждые 5 минут.
- [x] Автонапоминания об истечении и занятиях идемпотентны.
- [x] UI показывает только реальные метрики.
- [x] TypeScript, build, unit/security tests и desktop/mobile smoke проходят.

## Files and data

- Files: `src/lib/telegram/*`, `src/app/api/telegram/*`, `src/app/(app)/integrations/*`, `src/components/app/IntegrationManage.tsx`, `src/components/app/QrCheckinScanner.tsx`.
- Tables: `telegram_users`, `telegram_events`, `broadcasts`, `clients`, `subscriptions`, `class_bookings`, `visits`, `payments`.

## Must not break

Tenant isolation, auth, production data и существующие пользовательские сценарии.

## Changes

Добавлены multi-bot webhook, scoped contact linking, события доставки, production broadcasts schema, Supabase Cron, автонапоминания, расписание, QR scanner и Payme/Click renewal links. Экран Telegram переведён на дизайн-токены и реальные данные.

## Verification

`npx tsc --noEmit`, `npm run build`, 85 Vitest checks; headless desktop/mobile smoke без console errors и горизонтального overflow. Production migrations 0056–0059 применены. Deployment `dpl_BGgKzYRWv3c7dFKW8eriYrMUBCy4` READY; webhook совпадает с club route, pending updates `0`, last error отсутствует. Supabase Cron active, последний HTTP status `200`.

## Remaining

Настоящее recurring auto-charge требует tokenized/recurring API провайдера и пока не заявляется как работающая функция. Полноэкранный Telegram Mini App остаётся отдельным продуктовым этапом.

## Blockers

Нет.
