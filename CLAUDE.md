# CRM Project — Claude Notes

> Этот файл ведётся автоматически. Я обновляю его по мере работы над проектом.

---

## Общее

- **Тип проекта:** CRM-система
- **Рабочая директория:** `E:\crm`
- **Платформа:** Windows 11 Pro
- **Статус:** Проект инициализирован — Next.js 15 + shadcn/ui (09.06.2026)

---

## Стек и зависимости

| Слой | Технология |
|------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| API | tRPC v11 |
| Database | Supabase PostgreSQL |
| ORM | Prisma (только миграции) |
| Auth | Supabase Auth + JWT + RLS |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand + TanStack Query |
| Realtime | Supabase Realtime |
| Background | pg_cron → Edge Functions |
| Telegram Bot | Grammy.js (Railway/Fly.io, не Vercel) |
| Payments | Payme SDK + Click API |
| Validation | Zod |
| Encryption | Node.js crypto AES-256-GCM |
| QR | qrcode + jsQR |
| Deploy | Vercel (frontend) + Supabase Cloud (DB) |
| Monitoring | Sentry + Vercel Analytics |
| CI/CD | GitHub Actions |

---

## Структура проекта

```
src/
  app/
    layout.tsx            ← root layout (шрифты Inter + Oswald, html/body)
    globals.css           ← тёмная EPOQUE дизайн-система (токены, Oswald для h1-h4)
    (marketing)/          ← публичный лендинг
      page.tsx            → главная (Navbar, Hero, Clients, Features, Testimonials, Pricing, Faq, Download, Footer)
    (auth)/               ← вход/регистрация
      layout.tsx          → центрированная тёмная карточка
      login/page.tsx
      register/page.tsx
      actions.ts          → server actions: signIn, signUp, signInWithGoogle, signOut
      auth/callback/route.ts → обмен OAuth/email-кода на сессию (/auth/callback)
    (app)/                ← CRM за авторизацией
      layout.tsx          → сайдбар + топбар, серверная проверка getUser()
      dashboard/page.tsx  → заглушка дашборда
  middleware.ts           ← рефреш сессии Supabase + защита /dashboard, редирект с /login|/register
  lib/
    supabase/{client,server,middleware}.ts  ← Supabase clients (@supabase/ssr)
    utils.ts              → cn()
  components/
    landing/              ← компоненты лендинга (Navbar, Hero, MockDashboard, ...)
    auth/AuthForm.tsx     ← форма входа/регистрации
    app/                  ← Sidebar, SignOutButton
    ui/                   ← shadcn компоненты (button, input, accordion, ...)
```

> **Auth:** email/пароль + Google OAuth через Supabase (@supabase/ssr, cookie-based).
> Требует `.env.local` с `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` (шаблон — `.env.example`).
> Тема тёмная, заголовки — Oswald (uppercase), акцент — синий `#2563eb`.

ТЗ: `E:\crm\fitcrm_techspec.html` (v1.1)

---

## Ключевые решения и архитектура

- **Prisma + RLS:** Prisma только для миграций. Все пользовательские запросы — через Supabase client с JWT. Прямой service-role доступ только в Edge Functions с явной проверкой club_id.
- **payments ↔ subscriptions:** Связь `payments.subscription_id → subscriptions` (не наоборот). Один абонемент = много платежей.
- **Шифрование PII:** AES-256-GCM на уровне приложения. Поиск по телефону/имени через HMAC-SHA256(value, pepper), pepper в Supabase Vault.
- **Telegram Bot:** Деплоится отдельно (Railway/Fly.io), не на Vercel — из-за 25 сек timeout.
- **Мультитенантность:** RLS по club_id на всех таблицах. Пользователь может быть в нескольких клубах, текущий club_id в JWT claim.
- **SaaS-тарифы:** clubs.plan (starter/standard/business/trial) + trial_expires_at.

---

## Модели данных

MVP-сущности (21 таблица):
`clubs`, `users`, `clients`, `memberships`, `subscriptions`, `visits`, `payments`, `staff`, `rooms`, `schedules`, `classes`, `class_bookings`, `products`, `inventory`, `stock_movements`, `notifications`, `notification_templates`, `audit_logs`

V2: `leads`, `salary_rules`, `loyalty_points`

Подробная схема в ТЗ: `E:\crm\fitcrm_techspec.html`, раздел 05.

---

## API и интеграции

| Сервис | Тип | Статус | Примечание |
|--------|-----|--------|------------|
| Figma  | MCP Remote Server | Подключён | `https://mcp.figma.com/mcp` |

## Figma файлы

| Файл | Ссылка | Назначение |
|------|--------|-----------|
| CRM References | `https://www.figma.com/design/0nRV0pOtGp7kffK40inkRf/CRM?node-id=21-1150` | Референсы по экранам (страница Reference, 7 фреймов с заметками) |

### Именование фреймов в файле CRM

| Префикс | Что это |
|---------|---------|
| `CRM - LANDING` | Экраны публичного лендинга (маркетинговый сайт) |
| `CRM - DASHBOARD` | Экраны самой CRM-системы (продукт, который продаём) |

---

## Команды

```bash
npm run dev      # запуск dev-сервера (localhost:3000)
npm run build    # production сборка + проверка TypeScript
npm run lint     # ESLint проверка
```

---

## Известные проблемы и ограничения

_Баги, workaround'ы, технический долг._

---

## История изменений

| Дата       | Что сделано                          |
|------------|--------------------------------------|
| 09.06.2026 | Создан CLAUDE.md, проект инициализирован |
| 09.06.2026 | Подключён Figma MCP Remote Server (`figma@claude-plugins-official`) |
| 09.06.2026 | Добавлено ТЗ `fitcrm_techspec.html` v1.1 с исправленной схемой БД, стеком, архитектурными решениями |
| 09.06.2026 | Инициализирован Next.js 15 (App Router, TypeScript, Tailwind) |
| 10.06.2026 | Лендинг переделан в тёмную EPOQUE-тему (Oswald, синий акцент, bento) |
| 10.06.2026 | Реструктуризация в route groups: (marketing), (auth), (app) |
| 10.06.2026 | Авторизация Supabase (email/пароль + Google OAuth), middleware-защита роутов |
