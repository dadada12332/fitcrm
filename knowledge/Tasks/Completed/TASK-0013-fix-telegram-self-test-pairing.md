---
id: TASK-0013
type: bug
status: completed
priority: P1
module: integrations
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, task, telegram, security]
---

# Исправить тестовую отправку Telegram без клиентов

## Problem

«Отправить себе» требовало Telegram-привязку сотрудника, но бот связывал сотрудника только по телефону из `staff.settings`. У владельцев после onboarding телефон часто отсутствует, поэтому `/start` не создавал связь.

## Changes

- Добавлена одноразовая staff pairing link сроком 15 минут.
- В БД хранится SHA-256 hash, raw token существует только в ссылке.
- Bot `/start staff_*` атомарно помечает ссылку использованной и привязывает Telegram к staff текущего клуба.
- Empty state объясняет разницу между массовой рассылкой и тестом себе.
- Массовая кнопка недоступна при аудитории `0`; тестовая отправка остаётся доступной после привязки.

## Verification

`npx tsc --noEmit`, `npm run build`, 87 Vitest checks и targeted ESLint прошли. Migration `0060_telegram_staff_pairing.sql` применена к production: RLS включён, `anon/authenticated` не имеют SELECT, `service_role` имеет INSERT. Deployment `dpl_CeqtRAvPpZEtWVzZbGfgWimeyJg8` READY и активен на `fitcrm-three.vercel.app`; Telegram webhook URL совпадает, pending updates `0`, last error отсутствует.

## Remaining

Пользователь должен один раз открыть ссылку и нажать Start в Telegram; бот не может первым начать личный диалог с пользователем.
