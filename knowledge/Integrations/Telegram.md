---
type: integration
status: active
updated: 2026-07-18
tags: [fitcrm, telegram, integrations]
---

# Telegram Integration

## Product model

Каждый клуб подключает собственного бота токеном от BotFather. Токен хранится только в service-role таблице `telegram_integrations`, а публично читаемое legacy-поле `clubs.tg_token` очищено. FitCRM регистрирует webhook `/api/telegram/webhook/[clubId]`, команды и menu button. Общий `TELEGRAM_CRM_BOT_TOKEN` не используется как клиентский бот клуба.

Клиент нажимает `/start` и делится собственным Telegram contact. Поиск выполняется только среди `staff` и `clients` данного `club_id`; чужой пересланный контакт отклоняется. Связь хранится в `telegram_users` с unique `(club_id, telegram_id)`, поэтому один человек может состоять в нескольких клубах.

## Client bot

- Абонемент, остаток дней/посещений и история визитов.
- Расписание клуба на сегодня и напоминание о забронированных занятиях.
- Персональные toggles напоминаний.
- QR-код клиента; администратор сканирует его на мобильном экране `/visits`.
- Онлайн-продление текущего типа абонемента через подключённый Payme или Click. Создаётся pending payment; новая подписка активируется только после подписанного callback провайдера.
- Контакты клуба.

`Автопродление` в смысле автоматического списания не реализовано: текущие Payme/Click payment links не дают FitCRM подтверждённого recurring mandate/card token. До появления provider API продукт предлагает self-service renewal и reminders, но не обещает auto-charge.

## CRM features

- Подключение/замена/отключение бота с реальной регистрацией/удалением webhook.
- Рассылки по аудиториям, изображение, тест себе, история и отложенная отправка.
- Supabase Cron `fitcrm-broadcasts-every-5m` вызывает `/api/broadcasts/run`; secret хранится в Vault. Повторная настройка: `node scripts/configure-broadcast-scheduler.mjs <env-file-with-CRON_SECRET>`.
- Ежедневный Vercel Cron `/api/telegram/reminders/run` отправляет expiry reminders и расписание на день.
- Метрики строятся из `broadcasts`, `telegram_events` и `visits`, без расчётных заглушек.

## Security invariants

- Dynamic webhook получает token только service-side и проверяет `X-Telegram-Bot-Api-Secret-Token` через constant-time comparison.
- Bot handlers всегда получают route `clubId`; все service-role запросы вручную фильтруются по нему.
- Connect/disconnect/settings/broadcast Server Actions проверяют `telegram.manage`.
- Broadcast Storage upload/delete ограничены первой папкой `clubId`; broad listing policy удалена.
- `telegram_users` недоступна `anon/authenticated`; `telegram_events` доступна членам клуба только на чтение.

## Operations

После изменения `CRON_SECRET` нужно повторно зарегистрировать webhook клубных ботов, потому что webhook secret выводится HMAC от `clubId + token + CRON_SECRET`. Проверка health выполняется Telegram `getWebhookInfo`; токены и secret values запрещено писать в Vault или логи.

## Next evolution

Telegram Mini App подходит для полноценного кабинета с несколькими экранами, оплатой, бронированием и динамическим QR. Bot messages остаются каналом уведомлений и быстрых действий; Mini App не должен заменять CRM authorization или tenant checks.

## Sources

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
