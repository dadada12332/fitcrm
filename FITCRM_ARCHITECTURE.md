# FitCRM — Архитектура

> **Версия документа:** 1.0
> **Дата последнего обновления:** 2026-07-06
> **Статус:** отражает фактическую реализацию в репозитории (не планы)
> **Связанные документы:** [FITCRM_PROJECT_DOCUMENTATION.md](./FITCRM_PROJECT_DOCUMENTATION.md) · [FITCRM_CHANGELOG.md](./FITCRM_CHANGELOG.md) · [FITCRM_ROADMAP.md](./FITCRM_ROADMAP.md)

---

## Содержание

1. [Обзор архитектуры](#1-обзор-архитектуры)
2. [Схема взаимодействия сервисов](#2-схема-взаимодействия-сервисов)
3. [Frontend](#3-frontend)
4. [Backend (Server Actions + RPC)](#4-backend-server-actions--rpc)
5. [База данных](#5-база-данных)
6. [RLS — изоляция арендаторов](#6-rls--изоляция-арендаторов)
7. [Аутентификация](#7-аутентификация)
8. [Middleware и маршрутизация доменов](#8-middleware-и-маршрутизация-доменов)
9. [Platform Admin — архитектура](#9-platform-admin--архитектура)
10. [Полный список RPC-функций](#10-полный-список-rpc-функций)
11. [Триггеры и функции БД](#11-триггеры-и-функции-бд)
12. [Производительность](#12-производительность)
13. [Интеграции](#13-интеграции)
14. [Deployment](#14-deployment)

---

## 1. Обзор архитектуры

**Статус: ✅ Готово (базовая архитектура работает в проде)**

FitCRM — мультитенантный SaaS на **Next.js 16 (App Router)** + **Supabase** (Postgres + Auth + Storage), задеплоенный на **Vercel**.

Ключевые архитектурные принципы (все — по факту в коде):

| Принцип | Реализация |
|---|---|
| Server-first | React Server Components + Server Actions (`"use server"`), тяжёлая логика на сервере |
| Мультитенантность | Изоляция по `club_id` через RLS-политики и helper `user_club_ids()` |
| Единая БД | Один Postgres-инстанс Supabase, RLS разделяет данные клубов |
| Две плоскости | **CRM** (клубы) и **Platform Admin** (управление всем SaaS) в одном приложении |
| Service-role bypass | `createServiceClient()` обходит RLS — только после явной проверки прав |
| Серверная агрегация | Отчёты/списки считаются SQL-функциями (RPC), не в браузере |

Приложение делится на **три плоскости маршрутов** (route groups):

```
src/app/
  (marketing)/   — публичный лендинг
  (auth)/        — вход, регистрация, восстановление, OAuth callback
  (app)/         — сама CRM (за авторизацией)
  platform/      — Platform Admin (админка SaaS, отдельный хост)
  api/           — вебхуки, cron, telegram, платформенные ручки
  onboarding/    — создание первого клуба
  select-club/   — переключение между клубами
  accept-invite/ — приём приглашений в команду
```

---

## 2. Схема взаимодействия сервисов

**Статус: ✅ Готово**

```
                         ┌─────────────────────────┐
                         │      Пользователь        │
                         └───────────┬─────────────┘
                                     │ HTTPS
                                     ▼
              ┌──────────────────────────────────────────────┐
              │                  VERCEL (Edge + Node)          │
              │  Next.js 16 · Middleware (updateSession)       │
              └───────┬───────────────────┬──────────────┬────┘
                      │                   │              │
         ┌────────────▼────┐   ┌──────────▼───────┐  ┌───▼──────────┐
         │  Landing         │   │  app (CRM)       │  │ admin host   │
         │  (marketing)     │   │  (app) group     │  │ → /platform  │
         └──────────────────┘   └──────┬───────────┘  └───┬──────────┘
                                        │                  │
                     Server Actions / RPC / RLS            │ service-role
                                        │                  │ (bypass RLS)
                                        ▼                  ▼
              ┌──────────────────────────────────────────────────────┐
              │                    SUPABASE                            │
              │  Postgres (RLS)  ·  Auth  ·  Storage (avatars, tg img) │
              └───────┬───────────────────────────────┬───────────────┘
                      │                                │
             ┌────────▼─────────┐          ┌───────────▼────────────┐
             │  Telegram Bot     │          │  Vercel Cron           │
             │  (grammy)         │          │  · daily-report 04:00  │
             │  webhook / OTP    │          │  · broadcasts   03:00  │
             └───────────────────┘          └────────────────────────┘

Поток аутентификации/маршрутов:
  Landing → /login → (app) CRM → [опц.] Platform → Supabase → Storage → Telegram
  Платёжные провайдеры (Click/Payme/Uzum): ❌ только лейблы, шлюз не подключён
```

> ⚠️ **Важно по факту:** блоки `Payments (шлюз)` в этой схеме **не реализованы** как реальная интеграция. В БД есть enum `payment_provider` (`click/payme/uzum/cash`), но платежи создаются как записи вручную — живого приёма оплат через Payme/Click SDK нет.

---

## 3. Frontend

**Статус: ✅ Готово**

| Слой | Технология | Статус |
|---|---|---|
| Framework | Next.js 16.2.7 (App Router, Turbopack) | ✅ |
| UI-рантайм | React 19.2.4 / React DOM 19.2.4 | ✅ |
| Язык | TypeScript 5 (strict) | ✅ |
| Стили | Tailwind CSS v4 (`@tailwindcss/postcss`) | ✅ |
| Дизайн-система | shadcn поверх `@base-ui/react` (Zinc-токены) | ✅ |
| Иконки | lucide-react | ✅ |
| Графики | recharts 3 | ✅ |
| Анимации | framer-motion 12, lenis (smooth scroll) | ✅ |
| Темизация | next-themes (light/dark, токены `var(--…)`) | ✅ |
| Экспорт | exceljs, xlsx, jspdf, jspdf-autotable, qrcode | ✅ |

**Рендеринг:** страницы — серверные компоненты; интерактив вынесен в клиентские компоненты (`"use client"`). Данные грузятся серверными экшенами и RPC. Тяжёлые страницы используют `loading.tsx` (Suspense-скелетоны).

**Дизайн-система:** все цвета — CSS-переменные (`var(--card)`, `var(--border)`, `var(--on-dark)` и т.д.) с алиасами для light/dark. Захардкоженные цвета считаются багом (последний известный — дашборд, исправлен 2026-07-06).

---

## 4. Backend (Server Actions + RPC)

**Статус: ✅ Готово**

Бэкенд — это **не отдельный сервис**, а серверная часть Next.js:

- **Server Actions** (`"use server"`) — мутации и загрузка данных (создание клиента, оплаты, приглашения и т.д.). Правило: в `"use server"`-файле экспортируются **только async-функции**.
- **RPC (Postgres-функции)** — тяжёлые чтения и агрегации: пагинация, KPI, отчёты, метрики платформы. Вызываются через `supabase.rpc(...)`.
- **Три клиента Supabase:**

| Клиент | Файл | Назначение |
|---|---|---|
| Browser | `src/lib/supabase/client.ts` | клиентские компоненты |
| Server | `src/lib/supabase/server.ts` | серверные компоненты/экшены (cookie-сессия, RLS) |
| Service | `src/lib/supabase/service.ts` | service-role, **обход RLS** — только после проверки прав |
| Middleware | `src/lib/supabase/middleware.ts` | рефреш сессии + маршрутизация доменов |

**Библиотека доменной логики** (`src/lib/`): `club.ts` (текущий клуб + права), `permissions.ts` (RBAC), `clients.ts`, `payments.ts`, `visits.ts`, `memberships.ts`, `schedule.ts`, `staff.ts`, `inventory.ts`, `reports.ts`, `dashboard.ts`, `platform.ts`, `import-wizard.ts`, `broadcast.ts`, `knowledge.ts`, `telegram/bot.ts`, `client-profile.ts`, `sidebar.ts`, `perf.ts`.

---

## 5. База данных

**Статус: ✅ Готово (25 таблиц)**

Одна БД Postgres (Supabase). Миграции — файлы `supabase/migrations/0001…0036`, применяются вручную/через Management API (см. §14). Полное описание полей — в [FITCRM_PROJECT_DOCUMENTATION.md, раздел 6](./FITCRM_PROJECT_DOCUMENTATION.md).

**Группы таблиц:**

```
Ядро CRM (0001):
  users, clubs, staff, clients, memberships, subscriptions,
  visits, payments, rooms, schedules, classes, class_bookings,
  products, inventory, stock_movements,
  notification_templates, notifications, audit_logs
Роли (0013):        club_roles
Telegram (0010):    telegram_users
Рассылки (0012):    broadcasts
Platform (0023,0027): platform_admin_logs, platform_promo_codes,
                      platform_tickets, platform_billing_requests
```

**Ключевые enum-типы:** `club_plan(starter/standard/business/trial)`, `subscription_status(active/frozen/expired/cancelled)`, `visit_method(manual/qr/telegram)`, `payment_provider(click/payme/uzum/cash)`, `payment_status(pending/paid/failed/refunded)`, `class_status`, `class_booking_status`, `stock_movement_type`, `notification_channel`, `notification_status`.
`staff.role` был enum, с миграции 0013 переведён в `text` (гибкие роли через `club_roles`).

**Storage-бакеты:** `avatars` (0016), бакет картинок для Telegram-рассылок (0012).

---

## 6. RLS — изоляция арендаторов

**Статус: ✅ Готово**

Мультитенантность полностью держится на **Row Level Security**.

**Helper-функция** (SECURITY DEFINER):
```sql
create function public.user_club_ids() returns setof uuid as $$
  select club_id from public.staff where user_id = auth.uid();
$$;
```

**Политики:**
- `users` — только своя строка (`id = auth.uid()`).
- `clubs` — SELECT членам (`id in user_club_ids()`), UPDATE владельцу (`owner_id = auth.uid()`), INSERT — только через `create_club()`.
- `staff` — SELECT членам своего клуба.
- **15 club-scoped таблиц** (`clients`, `memberships`, `subscriptions`, `visits`, `payments`, `rooms`, `schedules`, `classes`, `class_bookings`, `products`, `inventory`, `stock_movements`, `notification_templates`, `notifications`, `audit_logs`) — политика `<table>_club_all`: `FOR ALL USING (club_id in user_club_ids())`.
- `club_roles` (0013) — SELECT членам, ALL — владельцу.
- **Platform (0024):** `user_club_ids()` расширена так, что для пользователей с `platform_role IS NOT NULL` она возвращает **все** клубы → админ платформы видит/правит любой клуб (нужно для support-режима).

**Обход RLS:** `createServiceClient()` (service-role) — для платформенных операций и там, где права уже проверены в коде вручную. Это единственный легальный путь мимо RLS.

---

## 7. Аутентификация

**Статус: ✅ Готово (email/password, Google OAuth, phone OTP)**

Через **Supabase Auth** (`@supabase/ssr`, cookie-сессии).

| Метод | Статус | Детали |
|---|---|---|
| Email + пароль | ✅ | `(auth)/login`, `(auth)/register` |
| Google OAuth | ✅ | `(auth)/auth/callback` обменивает код на сессию |
| Phone OTP | ✅ | OTP доставляется через **Telegram** (`api/auth/sms-hook`, Supabase Auth Hook, Standard Webhooks signature) — не через SMS-провайдера |
| Восстановление пароля | ✅ | `(auth)/forgot-password`, `(auth)/reset-password` |
| Приглашения в команду | ✅ | `accept-invite/[token]`, инвайт по email или по ссылке |

**Профиль:** триггер `on_auth_user_created` → `handle_new_user()` создаёт строку в `public.users` при регистрации.

---

## 8. Middleware и маршрутизация доменов

**Статус: ✅ Готово**

`src/proxy.ts` → `updateSession()` (`src/lib/supabase/middleware.ts`).

**Функции middleware:**
1. **Рефреш сессии** Supabase на каждый запрос (оптимизировано: без лишнего `getUser()` на prefetch).
2. **Маршрутизация доменов:**
   - `admin.fitcrm.uz` → внутренние роуты `/platform/*` через rewrite (префикс `/platform` не светится в URL).
   - Локально/на основном домене Platform доступен напрямую по `/platform/*`.
3. **Защита роутов:** неавторизованные редиректятся на `/login` (или `/platform/login` на admin-хосте). Публичные: лендинг, `(auth)`, `/platform/login`.

**Impersonation (support-режим):** cookie `pa_impersonate` + `platform_role` у пользователя → `getCurrentClub()` через service-role подгружает целевой клуб с правами владельца (`impersonating: true`). Выход — `api/platform/stop-impersonation`.

---

## 9. Platform Admin — архитектура

**Статус: ✅ Готово (функционально), см. оговорки по разделам**

Отдельная плоскость `src/app/platform/(protected)/` для управления всем SaaS.

- **Доступ:** только `platform_role ∈ {platform_admin, super_admin}` (колонка в `users`, миграция 0023). Резервная проверка — по списку email (`SUPER_ADMIN_EMAILS`).
- **Данные:** через `src/lib/platform.ts` на **service-role** (видит все клубы, обходя RLS).
- **Разделы:** dashboard (command center), clubs + карточка клуба `[id]`, users, subscriptions, payments, monitoring, logs, broadcasts, promo, support, settings, analytics.
- **Health Score** (`computeHealthScore`) — 0..100 из метрик: посещения за 30 дней, активные клиенты, свежесть оплаты, не истёк ли план, наличие команды.
- **Метрики списка клубов** — RPC `platform_clubs_metrics(ids)` (агрегаты count/max, без вытягивания строк — иначе упор в лимит 1000 строк PostgREST, баг исправлен 2026-07-06).
- **Биллинг:** клуб создаёт заявку (`platform_billing_requests`), админ платформы подтверждает → активируется тариф.

---

## 10. Полный список RPC-функций

**Статус: ✅ Готово (22 функции)**

| RPC | Миграция | Назначение |
|---|---|---|
| `user_club_ids()` | 0001 | Клубы текущего пользователя (основа RLS) |
| `create_club(name, city)` | 0001 | Онбординг: клуб + staff-owner + trial 14 дней |
| `handle_new_user()` | 0001 | Триггер: профиль при регистрации |
| `create_default_club_roles(club_id)` | 0013 | 6 системных ролей для клуба |
| `trigger_create_default_club_roles()` | 0013 | Триггер: роли при создании клуба |
| `get_layout_context()` | 0018 | Единый контекст layout (клуб, роль, счётчики, trial) — экономит round-trips |
| `get_dashboard_stats()` | 0018 | Агрегаты дашборда |
| `get_payments_kpi(...)` | 0021 | KPI оплат: 5 запросов → 1 RPC |
| `get_visits_kpi(...)` | 0021 | KPI посещений одним вызовом |
| `clients_page(...)` | 0025 | Серверная пагинация/поиск/фильтр/сортировка клиентов (статус из подписок) |
| `clients_stats(...)` | 0025 | Счётчики по статусам клиентов |
| `payments_page(...)` | 0026 | Серверная пагинация оплат |
| `visits_page(...)` | 0026 | Серверная пагинация посещений |
| `reports_finance(...)` | 0028 | Отчёты: финансы (revenue/count/prev/byProvider/byDay) |
| `reports_sales(...)` | 0029 | Отчёты: продажи по тарифам |
| `reports_visits(...)` | 0030 | Отчёты: посещения (total/prev/byDay/heatmap, TZ Asia/Tashkent) |
| `reports_clients(...)` | 0031 | Отчёты: клиенты (new/active/expired/gender/source/byDay) |
| `reports_renewals(...)` | 0032 | Отчёты: продления (expiring 30/7, top-10) |
| `reports_debts(...)` | 0033 | Отчёты: долги (pending, сумма, список) |
| `reports_staff(...)` | 0034 | Отчёты: персонал (клиенты/зарплата/статус) |
| `reports_alerts(...)` | 0035 | Отчёты: «Внимание» (истечения, отток, долги) |
| `platform_clubs_metrics(ids)` | 0036 | Platform: метрики клубов агрегатами |

Все RPC — `security definer`, `stable`, `set search_path = public`, с `grant execute` для `authenticated`/`service_role`.

---

## 11. Триггеры и функции БД

**Статус: ✅ Готово**

| Триггер | Событие | Действие |
|---|---|---|
| `on_auth_user_created` | INSERT `auth.users` | `handle_new_user()` — создать профиль |
| `after_club_insert_create_roles` | INSERT `clubs` | `trigger_create_default_club_roles()` — 6 системных ролей |

Индексы: базовые по `club_id`/FK (0001), композитные для частых фильтров (0017), текстовый поиск и доп. индексы (0020, включая `pg_trgm`).

---

## 12. Производительность

**Статус: ✅ Готово (значимые оптимизации внедрены)**

| Оптимизация | Где | Статус |
|---|---|---|
| `React.cache` для `getCurrentClub` | `lib/club.ts` | ✅ |
| Единый layout-контекст одним RPC | `get_layout_context` | ✅ |
| KPI: N запросов → 1 RPC | `get_payments_kpi`, `get_visits_kpi` | ✅ |
| Серверная пагинация/поиск/сортировка/фильтр | `clients_page`, `payments_page`, `visits_page` | ✅ |
| Серверная агрегация всех 9 вкладок отчётов | `reports_*` | ✅ |
| Ленивая загрузка вкладок отчётов + кеш 120 c | `unstable_cache` | ✅ |
| Экспорт по требованию (не на каждый заход) | Reports export | ✅ |
| Батч-выборка > лимита 1000 строк | `fetchAllRows` | ✅ |
| Композитные индексы + `pg_trgm` | 0017, 0020 | ✅ |
| Метрики платформы агрегатами | `platform_clubs_metrics` | ✅ |
| Suspense / `loading.tsx` скелетоны | по разделам | ✅ |

**Замеренный эффект:** страница «Отчёты» на клубе с 21 199 клиентами — с ~72 c до **2.2 c** после перевода на серверную агрегацию (2026-07). Экспорт грузит сырьё по клику (~17–50 c) со статусом «Готовим…».

> ⚠️ **Не реализовано:** Realtime-подписки Supabase, streaming SSR, серверный рендер PDF (PDF/CSV генерируются на клиенте из выгруженных сырых данных).

---

## 13. Интеграции

**Статус: 🚧 Частично**

| Интеграция | Статус | Детали |
|---|---|---|
| Telegram Bot (клиентский) | ✅ | grammy; `/start /menu /sub /qr /help`, привязка по контакту, QR для check-in |
| Telegram: webhook клуба | ✅ | `api/telegram/club-webhook`, `api/telegram/setup` |
| Telegram: рассылки | ✅ | `broadcasts` + cron `api/broadcasts/run` (раз в сутки, лимит Vercel Hobby) |
| Telegram: ежедневный отчёт | ✅ | cron `api/telegram/daily-report` 04:00 |
| Telegram: OTP для входа | ✅ | `api/auth/sms-hook` (Supabase Auth Hook) |
| Storage (avatars, tg-картинки) | ✅ | Supabase Storage |
| Платёжные шлюзы (Click/Payme/Uzum) | ❌ | только enum-лейблы, живого приёма оплат нет |
| SMS-провайдер | ❌ | OTP идёт через Telegram, реального SMS-шлюза нет |
| Разговорный AI / LLM | ❌ | нет SDK (Anthropic/OpenAI), см. документацию §13 |

---

## 14. Deployment

**Статус: ✅ Готово**

| Аспект | Реализация |
|---|---|
| Хостинг | Vercel (Next.js 16, регион iad1) |
| Домены | основной (CRM) + `admin.fitcrm.uz` (Platform, rewrite на `/platform`) |
| БД/Auth/Storage | Supabase Cloud (ref `bqnhslauxvukejtquavp`) |
| Деплой | `npx vercel deploy --prod` (авто-деплой не используется) |
| Миграции | вручную через Supabase SQL Editor **или** через Management API (`scripts/apply-migration.mjs` + `SUPABASE_ACCESS_TOKEN`) |
| Cron | `vercel.json`: daily-report 04:00, broadcasts 03:00 (UTC) |
| Env | `.env.local`: Supabase URL/anon/service-role, Telegram-токены, cron-секреты, `SUPABASE_ACCESS_TOKEN` |

> Ограничение Vercel Hobby: cron только «раз в сутки» (суб-суточный интервал недоступен) — поэтому рассылки/отчёты раз в день.

---

*Конец документа. См. также [полную документацию](./FITCRM_PROJECT_DOCUMENTATION.md).*
