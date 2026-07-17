---
type: project-context
status: active
updated: 2026-07-18
tags: [fitcrm, context]
---

# Project Context

## Продукт

FitCRM — мультитенантная SaaS CRM для фитнес-клубов и спортивных студий Узбекистана. Основной интерфейс русский, валюта UZS, рабочая временная зона `Asia/Tashkent`. Бизнес-модель — подписка клуба на тариф платформы; платежи клиентов клуба образуют отдельный контур.

## Стек

- Next.js 16 App Router, React 19, TypeScript.
- Server Actions для серверных мутаций.
- Supabase: Postgres, RLS, Auth, Realtime и Storage.
- Tailwind CSS 4, shadcn/ui Zinc, Base UI.
- grammy для Telegram.
- Vercel для приложения и cron.
- Prisma и tRPC не используются.

## Модули

CRM: dashboard, клиенты, абонементы, посещения, расписание, оплаты, склад, сотрудники, отчёты, интеграции, поддержка и настройки. Отдельный Platform Admin управляет клубами, пользователями, тарифами, заявками, платежами, мониторингом и поддержкой.

Подробная карта: [[Architecture/Ownership Map]]. Термины: [[Product/Glossary]].

## Роли и multi-tenancy

Tenant — клуб. Строки бизнес-данных изолируются по `club_id`. Пользователь может состоять в нескольких клубах. Основные роли: owner, admin, manager, trainer, accountant, cashier и кастомные роли.

## Безопасность

RLS гарантирует изоляцию клуба, но не гранулярные права роли. Каждая мутирующая Server Action обязана вызвать `getCurrentClub()` и проверить `can(club.permissions, module, action)`. `createServiceClient()` обходит RLS и требует ручного scope по `club.clubId`. Поиск через `.or(...ilike...)` использует `sanitizeSearchTerm()`.

Контрольный список: [[Infrastructure/Security Checklist]].

## Интеграции и инфраструктура

Поддерживаются Telegram, Payme и Click; часть уведомлений SMS/email не имеет реального провайдера. Production размещён в Vercel, данные — Supabase. Фактическая матрица: [[Infrastructure/Environment Matrix]].

## Дизайн

Источник — `DESIGN_SYSTEM.md`, Figma и примитивы `src/components/ui/`. Используются семантические токены shadcn, light/dark темы; сырые hex в продуктовых компонентах не добавляются.

## Production

- Миграции запускаются через `node scripts/apply-migration.mjs <file>`.
- Push в `main` запускает Vercel deploy; alias домена может требовать ручного обновления.
- Секреты находятся вне Git и подтягиваются через `vercel env pull .env.local`.
- Перед рискованными изменениями обязательны TypeScript/build и целевые проверки.

## Ограничения

- Нет unit/integration набора и CI.
- SMS/email уведомления фактически не отправляются.
- Backup/restore и наблюдаемость требуют production-подтверждения.
- Старые `FITCRM_*` документы являются историческими снимками и могут противоречить коду.
