# FitCRM — гид для Claude и разработчика

> Этот файл читается автоматически (Claude Code) на любом ПК. Если ты — Claude на новой машине: **прочитай его целиком перед работой**, здесь всё, чтобы не потерять контекст.

> Оперативный контекст: [`knowledge/10 AI Handoff.md`](./knowledge/10%20AI%20Handoff.md). Единый процесс завершения задач: [`AI_WORKFLOW.md`](./AI_WORKFLOW.md).

---

## 1. Что это

**FitCRM** — мультитенантный SaaS CRM для фитнес-клубов (тренажёрные залы, студии, секции).
- Аудитория: **Узбекистан**. Валюта **UZS (сум)**, интерфейс **на русском**, таймзона **Asia/Tashkent**.
- Мультитенантность: все данные скоупятся по **`club_id`**. Один пользователь может быть в нескольких клубах.
- Прод: **Vercel**, alias **`fitcrm-three.vercel.app`**. Планируемый домен — `fitcrm.uz` (+ `admin.fitcrm.uz` для платформы).

## 2. Стек (актуальный — старые упоминания tRPC/Prisma неверны, их НЕТ)

| Слой | Технология |
|------|-----------|
| Framework | **Next.js 16.2.7** (App Router, **Turbopack**), **React 19** |
| Данные/бэкенд | **Server Actions** (`"use server"`) + **Supabase** (Postgres + RLS + Auth + Realtime + Storage) |
| Supabase client | `@supabase/ssr` (cookie-based), `@supabase/supabase-js` |
| Стили | **Tailwind CSS v4**, `next-themes` (тёмная/светлая) |
| UI/анимации | `framer-motion`, `sonner` (тосты), `lenis` (smooth scroll), `recharts` (графики), `lucide-react` (иконки) |
| Telegram-бот | `grammy` |
| Валидация | `zod` |
| Деплой | **Vercel** (фронт + serverless) + **Supabase Cloud** (БД) |

Скрипты: `npm run dev` / `build` / `start` / `lint`. **Юнит-тестов нет** (есть только dep `playwright`, но без тестов).

## 3. Быстрый старт на новом ПК

Секреты **не в git** (`.env*` в `.gitignore`). Источник правды по секретам — **Vercel**:

```bash
git clone https://github.com/dadada12332/fitcrm.git
cd fitcrm
npm install
npm i -g vercel && vercel link      # один раз
vercel env pull .env.local          # ← тянет ВСЕ значения из Vercel
npm run dev
```

Список нужных переменных — в **`.env.example`**. Ключевые: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (секрет, обходит RLS), `SUPABASE_ACCESS_TOKEN` (для миграций), `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_*`, `PAYMENT_ENC_KEY`, `CRON_SECRET`.

⚠️ **Никогда не коммить `.env.local`** — там боевые ключи, git хранит историю навсегда.

## 4. Деплой (ВАЖНО — есть нюансы)

**Git-авто-деплой РАБОТАЕТ:** репо подключено к Vercel, `git push` в `main` → авто-деплой на прод.
Обычно **просто пушь**, отдельный `vercel deploy` не нужен.

**Нюанс с alias:** `fitcrm-three.vercel.app` — ручной alias, сам за прод НЕ следует. После пуша
один раз навести:
```bash
npx vercel ls fitcrm     # верхний Ready https://fitcrm-XXXX-crm228.vercel.app
npx vercel alias set fitcrm-XXXX-crm228.vercel.app fitcrm-three.vercel.app
```
Постоянный фикс (1 шаг в дашборде, ещё не сделан владельцем): Vercel → fitcrm → Settings → Domains
→ привязать `fitcrm-three.vercel.app` к Production (main) → alias станет авто.

**Ручной деплой** (редко нужен): `npx vercel deploy --prod --yes`. Но push и так триггерит
git-деплой → ручной вызов = двойная сборка. macOS: нет `timeout`, CLI-поллинг часто ETIMEDOUT
(деплой всё равно идёт) → в фон + `sleep` + опрос `vercel inspect` на Ready.

Не пушить `.github/workflows/*` (GitHub-токен без scope `workflow` → push отклонится).
Владелец просил **деплоить самостоятельно, без запроса подтверждения**.

> Полный контекст проекта — в `HANDOFF.md`.

## 5. Миграции БД

SQL-миграции в `supabase/migrations/NNNN_*.sql`. Применять **самому**:

```bash
node scripts/apply-migration.mjs supabase/migrations/00NN_xxx.sql
```

(Скрипт использует Supabase Management API + `SUPABASE_ACCESS_TOKEN` из `.env.local`.) Последняя на момент написания — `0051_security_hardening.sql`.

## 6. Архитектура и мультитенантность

- **RLS** — основа изоляции. Функция `public.user_club_ids()` возвращает клубы, где юзер — staff. Политики на клубных таблицах: `club_id in (select user_club_ids())` (`for all`).
- **`getCurrentClub()`** (`src/lib/club.ts`) — текущий клуб + роль + права из cookie/сессии. Поддерживает impersonation платформенным админом (cookie `pa_impersonate`).
- **`createClient()`** (`src/lib/supabase/server.ts`) — клиент с сессией юзера (**под RLS**). Использовать по умолчанию.
- **`createServiceClient()`** (`src/lib/supabase/service.ts`) — service-role, **обходит RLS**. Только когда реально нужно; тогда **вручную** скоупить по `club.clubId` и проверять права.

## 7. Безопасность (КРИТИЧНЫЙ инвариант)

**RLS скоупит данные ТОЛЬКО по клубу.** Гранулярные права (`club.permissions.{clients,payments,finance,staff,...}`) и роли RLS **не проверяет**.

➡️ **Каждый мутирующий Server Action ОБЯЗАН** сам проверять права:
```ts
const club = await getCurrentClub()
if (!club) return { error: "..." }
if (!club.permissions.staff.edit && !["owner","admin"].includes(club.role)) return { error: "Недостаточно прав" }
```
Server Actions — это открытые эндпоинты, скрытые кнопки в UI НЕ защищают. Пропуск проверки = эскалация привилегий (был такой баг в `staff/actions.ts`, исправлен).

Ещё: поиск через `.or(...ilike...)` — только через **`sanitizeSearchTerm()`** (`src/lib/search.ts`), иначе инъекция PostgREST-фильтра. Пароли — минимум 8 символов.

## 8. Структура

```
src/app/
  (marketing)/         ← публичный лендинг на / (светлая тема) + /about /contacts /docs /blog /terms /privacy
  (auth)/              ← login/register/forgot/reset, actions.ts (signUpWithClub, signInWithEmail, Google OAuth)
  (app)/               ← сама CRM (за авторизацией): dashboard, clients, memberships, visits, payments,
                         schedule, staff, warehouse, reports, integrations, ai, support, knowledge, settings, profile
  onboarding/          ← создание первого клуба (create_club RPC)
  select-club/         ← выбор клуба (если их несколько)
  accept-invite/       ← приём приглашения сотрудника
  platform/            ← платформенная админка SaaS (см. §10)
  api/                 ← вебхуки: telegram, pay/{payme,click}, cron, broadcasts, auth
  robots.ts, sitemap.ts
src/components/landing/v2/  ← компоненты лендинга (Navbar, Hero, Features, Pricing, Faq, Footer, ...)
src/lib/               ← club.ts, permissions.ts, i18n/, search.ts, supabase/, money, staff, visits, telegram/, plans, ...
supabase/migrations/   ← SQL-миграции (нумерованные)
scripts/apply-migration.mjs
```

Регистрация → `signUpWithClub` (создаёт клуб через `create_club` RPC при наличии сессии, иначе клуб создаётся на `/onboarding`) → `(app)/layout.tsx` гейтит: проверка auth, наличия клуба, блокировка при suspended/истёкшем триале/плане.

## 9. Лендинг

- Живёт на **`/`** (это бывший прототип `/v2`, стал основным; `/v2/*` → 308 редирект на `/`). Светлая тема.
- **Мультиязычность RU/EN/UZ**: клиентский переключатель + cookie/localStorage (`fitcrm_lang`), **RU по умолчанию** (SSR рендерит RU для SEO). Словарь: `src/lib/i18n/messages.ts`, хук `useT()` (`src/lib/i18n/context.tsx`), `LangProvider` подключён в `(marketing)/layout.tsx`, переключатель — `landing/v2/LangSwitcher.tsx`.
- Осознанно НЕ переведено (RU): названия/состав тарифов (из БД), мелкие подписи в анимированных мокапах, тело подстраниц.
- **SEO**: метаданные в `src/app/layout.tsx` (OG/Twitter/robots/canonical), `robots.ts`, `sitemap.ts`, JSON-LD в `(marketing)/page.tsx`. `SITE_URL = fitcrm-three.vercel.app` — заменить на боевой домен при подключении.
- Тарифы тянутся из БД (ISR 5 мин), правятся в Platform Admin без деплоя. Переключатель Год/−20% (`YEAR_DISCOUNT` в `PricingCards.tsx`).

## 10. Platform Admin (`/platform`)

Отдельная система управления SaaS (планируемый хост `admin.fitcrm.uz`). Service-role доступ, роль `platform_role` (`platform_admin`/`super_admin`), impersonation клубов. Управляет тарифами (таблица `plans`, поле `landing_benefits` — те самые преимущества на лендинге), метриками, биллингом.

## 11. Ключевые подсистемы

- **Платежи** — два контура: (A) оплата тарифа клубом → платёжка платформы; (B) оплаты клиентов внутри СРМ → платёжка клуба. Плюс сверка эквайринга (`reconcile`). Провайдеры: Payme, Click (`api/pay/*`).
- **AI-ассистент** `/ai` — чат на Gemini 2.5-flash (`GEMINI_API_KEY`), контекст данных клуба + vision + tools. В Telegram-боте AI-аналитика на Anthropic.
- **Центр поддержки** `/support` — тикеты, база знаний, AI (единая схема `support_*`).
- **Instant UI** — sonner-тосты + `RealtimeProvider` (Supabase Realtime, postgres_changes) для мгновенной синхронизации между вкладками/страницами.

## 12. Договорённости и стиль

- **Дизайн страниц (app)**: заголовок `h1` — `text-2xl font-semibold tracking-[-0.144px]`, вертикальные отступы `space-y-5`, **без** `p-6` на контейнере. (Это для `/app`, НЕ для лендинга.)
- Деплой и команды — **выполнять самостоятельно**, без запроса подтверждения.
- Секреты (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, токены) **не логировать**.
- Временные файлы — в системный tmp/scratchpad, не в проект.

## 13. Известные нюансы

- Border-radius не всегда обрезает под 3D-трансформом framer (WebKit/Blink) → фикс `transform: translateZ(0)` на обрезающем элементе.
- `Instagram` НЕ экспортируется из `lucide-react` → используем `Camera`.
- Уведомления (SMS/Email) реально не отправляются — нет провайдера; Telegram-крон шлёт в глобальный env-чат, не пер-тоггл.
- Дореализационный lint-долг (`any`, unused) — сборку не ломает.

---

_История: изначально задумывался как тёмный лендинг (EPOQUE/Solaris/v2/v3-эксперименты) → пришли к светлому лендингу на `/`. Стек с Next 15/tRPC/Prisma из старых заметок — устарел, сейчас Next 16 + Server Actions + Supabase._
