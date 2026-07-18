---
id: TASK-0016
type: security
status: done
priority: P1
module: telegram-miniapp
created: 2026-07-18
updated: 2026-07-18
owner: codex
tags: [fitcrm, telegram, miniapp, qr, security, mobile]
---

# Telegram identity and dynamic QR

## Symptom

Mini App показывал имя CRM-клиента вместо имени текущего Telegram-пользователя. Статический QR можно было сохранить скриншотом, а его изображение выходило за белую рамку на узком экране.

## Fix

- Имя и инициал в Mini App берутся из подписанного Telegram `initData`; CRM-клиент по-прежнему определяется только через ранее подтверждённую связь телефона и `telegram_users`.
- QR является HMAC-подписанным club/client pass со сроком жизни 30 секунд и случайным `jti`.
- После успешного сканирования `jti` записывается в service-only `qr_pass_redemptions`; повторное использование отклоняется.
- `/qr` в боте больше не отправляет статичное изображение и сразу открывает вкладку `Пропуск` Mini App.
- QR-контейнер ограничен по ширине и скрывает overflow; мобильный тест проверяет его фактические границы.

## Security boundary

Код снижает риск повторного использования скриншота, но не может помешать передать свежий код другому человеку и использовать его первым в пределах 30 секунд. Для более строгой защиты нужен дополнительный on-site фактор, например фото клиента у администратора или rotating scanner challenge.

## Verification

- Migration `0063` применена: RLS включён, grants только `postgres` и `service_role`.
- TypeScript, target ESLint, Vitest (`94 passed`, `1 skipped`) и production build passed.
- Local и remote mobile Playwright: имя Telegram, deep link в `Пропуск`, ротация QR, back navigation и отсутствие QR overflow.
- Production API smoke: Telegram name match, signed prefix, разные последовательные passes, TTL 29–30 секунд.
- Commit `efd8664`; deployment `dpl_8DAw8svNqn1mGJfiUd4ci5bymHAY` READY с alias `fitcrm-three.vercel.app`.
