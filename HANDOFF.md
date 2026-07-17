# FitCRM — полная передача проекта (Handoff для нового AI/CTO)

> Этот документ написан как передача дел от инженера, который строил FitCRM практически с нуля.
> Цель — чтобы новый ассистент (Codex) понял продукт, архитектуру, принятые решения и
> **почему** они приняты, включая то, от чего мы отказались. Читай целиком.
>
> Практические правила и «горячие» команды продублированы кратко в `CLAUDE.md` и `AGENTS.md`.
> Дизайн-система — в `DESIGN_SYSTEM.md`. Аудиты/замеры — в `SECURITY_AUDIT.md`, `QA_REPORT.md`,
> `QA_VERIFY.md`, `PERF_REPORT.md`, `PERF_VERIFY.md`.
>
> ⚠️ Важно про доверие к этому тексту: он отражает состояние на момент написания. Пути к файлам,
> имена функций и флаги **проверяй в коде** перед тем как на них опираться — проект активно менялся.

---

## 0. TL;DR за 60 секунд

- **FitCRM** — мультитенантный SaaS CRM для фитнес-клубов. Рынок — Узбекистан (валюта UZS/сум,
  интерфейс на русском, таймзона Asia/Tashkent). Клиенты — владельцы залов/студий/секций.
- **Стек:** Next.js 16 (App Router, Turbopack) + React 19 + **Server Actions** + **Supabase**
  (Postgres + RLS + Auth + Realtime + Storage). UI — **Tailwind v4 + shadcn/ui (Zinc)**.
  Telegram-бот — **grammy**. Деплой — **Vercel**. НЕТ tRPC, НЕТ Prisma (старые доки врут).
- **Мультитенантность:** всё скоупится по `club_id`. RLS изолирует данные по клубу.
  **Критично:** RLS проверяет ТОЛЬКО принадлежность к клубу, а гранулярные права —
  обязанность каждого Server Action (см. §7). Это главный инвариант безопасности.
- **Прод:** `https://fitcrm-three.vercel.app` (git push в `main` → авто-деплой Vercel).
  Планируемый домен: `fitcrm.uz` (+ `admin.fitcrm.uz` для платформенной админки).
- **Секреты не в git** — тянутся из Vercel: `vercel env pull .env.local`.
- **Миграции** применяются вручную: `node scripts/apply-migration.mjs supabase/migrations/NNNN.sql`.

---

## 1. Что такое FitCRM (продукт и бизнес)

FitCRM — это операционная система для управления фитнес-клубом. Один клуб (tenant) внутри
системы управляет: клиентами, абонементами, посещениями (в т.ч. QR-чекин), оплатами,
расписанием групповых занятий, складом товаров, сотрудниками (с ролями и зарплатами),
отчётами/аналитикой, Telegram-ботом (личный кабинет клиента + уведомления), AI-ассистентом,
центром поддержки.

**Модель:** SaaS по подписке. У платформы есть тарифы (Trial/Starter/Standard/Business),
которые продаются клубам. Клуб платит платформе (контур A). Внутри клуба клиенты платят клубу
за абонементы (контур B). Оба контура — разные (см. §16).

**Мультитенантность:** пользователь может быть сотрудником нескольких клубов; текущий клуб
определяется через `getCurrentClub()` (по staff-записи + cookie выбранного клуба). Данные
клубов строго изолированы.

**Язык/локаль:** продукт (админка `/app`) — русский. Лендинг — RU/EN/UZ. Деньги — UZS.

---

## 2. Технологический стек (и ПОЧЕМУ именно он)

| Слой | Технология | Почему / заметки |
|------|-----------|------------------|
| Framework | **Next.js 16** (App Router, **Turbopack**) | RSC + Server Actions дают простой fullstack без отдельного API-слоя. ⚠️ Next 16 — свежий, конвенции могли меняться; при сомнении смотри `node_modules/next/dist/docs/`. |
| UI-рантайм | **React 19** | Требуется Next 16. Используем `useTransition`, `useOptimistic`-паттерны, `cache()` из react. |
| Данные/бэкенд | **Server Actions** (`"use server"`) | Мутации — экшены в `*/actions.ts`. Нет REST/tRPC. **Важно:** экшены — открытые эндпоинты (см. §7). |
| БД/Auth/Realtime | **Supabase** (Postgres + RLS + Auth + Realtime + Storage) | Один провайдер на всё. RLS — ядро мультитенантности. Auth — email/пароль + Google OAuth + телефонный OTP (legacy для инвайтов). |
| Supabase-клиенты | `@supabase/ssr` (cookie-сессии), `@supabase/supabase-js` | `createClient()` — под RLS (сессия юзера). `createServiceClient()` — service-role, ОБХОДИТ RLS. |
| Стили | **Tailwind CSS v4** + **shadcn/ui (палитра Zinc)** на `@base-ui/react` | Канон дизайна — `DESIGN_SYSTEM.md`. Токены в `globals.css`. Примитивы в `src/components/ui/`. |
| Тема | `next-themes` (light/dark через класс `.dark`) | Любой новый UI обязан работать в обеих темах. |
| Анимации/графики | `framer-motion`, `recharts` (лениво), `lucide-react` (иконки), `lenis` (smooth scroll лендинга) | recharts тяжёлый → грузим через `next/dynamic ssr:false` (см. §22). |
| Тосты | `sonner` (через хелпер `src/lib/use-action.ts` → `runAction`) | Единый паттерн мгновенного UI. |
| Telegram-бот | **grammy** | У каждого клуба СВОЙ бот (`clubs.tg_token`). Плюс есть общий/системный бот из env. |
| Валидация | `zod` (местами) | Не везде; много ручной валидации в экшенах. |
| Деплой | **Vercel** (фронт + serverless) + **Supabase Cloud** (БД) | git push → авто-деплой. См. §5. |

**Скрипты (`package.json`):** `dev`, `build`, `start`, `lint`. **Юнит-тестов нет** (есть только
dev-зависимость `playwright`, но набора тестов нет — см. §25).

### От чего отказались (важно для понимания истории)
- **tRPC + Prisma** — фигурируют в старых доках (`FITCRM_ARCHITECTURE.md`, старый `CLAUDE.md`),
  но по факту НЕ используются. Всё на Server Actions + прямых Supabase-запросах. Не ищи их.
- **Отдельный API-слой** — не нужен, RSC/Server Actions закрывают потребности.

---

## 3. Структура репозитория

```
src/app/
  layout.tsx                 ← корневой layout: шрифты (Inter/Oswald/Playfair), ThemeProvider,
                                AppToaster, метаданные SEO (OG/Twitter/robots/canonical), lang="ru"
  globals.css                ← токены дизайн-системы (light в :root, dark в .dark) + @theme
  robots.ts, sitemap.ts      ← SEO (генерируются)
  (marketing)/               ← ПУБЛИЧНЫЙ лендинг на / + подстраницы
    layout.tsx               ← оборачивает в LangProvider (i18n) + SmoothScroll
    page.tsx                 ← главная (рендерит компоненты landing/v2), ISR revalidate=300, JSON-LD
    about|contacts|docs|blog|terms|privacy/  ← подстраницы (общий PageShell)
  (auth)/                    ← login, register, forgot-password, reset-password
    actions.ts               ← signUpWithClub, signInWithEmail, Google OAuth, OTP, signOut, reset
    auth/callback/route.ts   ← обмен OAuth/email-кода на сессию
  (app)/                     ← САМА CRM (за авторизацией)
    layout.tsx               ← ГЕЙТ: auth → club → блокировка (suspended/trial/plan) → AppShell
    actions.ts               ← globalSearch, notifications
    dashboard/ clients/ memberships/ visits/ payments/ schedule/ staff/ warehouse/
    reports/ integrations/ ai/ support/ knowledge/ settings/ profile/
    (у каждого раздела page.tsx + обычно actions.ts)
  onboarding/                ← создание первого клуба (create_club RPC)
  select-club/               ← выбор клуба, если их несколько
  accept-invite/[token]/     ← приём приглашения сотрудника
  platform/                  ← ПЛАТФОРМЕННАЯ АДМИНКА SaaS (тарифы, метрики, биллинг, impersonation)
    (protected)/plans/actions.ts  ← управление тарифами (влияет на лендинг)
  api/                       ← вебхуки и крон-роуты (НЕ публичное API):
    telegram/{webhook,club-webhook,setup,daily-report}/
    pay/{payme,click}/[clubId]/   ← колбэки эквайринга
    cron/reconcile/          ← сверка эквайринга (защищён CRON_SECRET)
    broadcasts/run/          ← отложенные Telegram-рассылки
    auth/sms-hook/           ← доставка OTP-кода авторизации (в системный TG-чат)
    invite-track/, platform/
src/components/
  landing/v2/                ← компоненты лендинга (Navbar, Hero, Features, Pricing, Faq, Footer,
                                LangSwitcher, PageShell, ...)
  landing/SmoothScroll.tsx   ← Lenis-обёртка (используется marketing layout)
  app/                       ← компоненты CRM (AppShell, Sidebar, DashboardBody, ScheduleToolbar,
                                RoomsManager, TelegramBroadcast, ClientProfileCard, StaffProfileClient,
                                LazyCharts, RevenueChart, ReportsClient, ...)
  ui/                        ← shadcn-примитивы (button, input, card, sheet, badge, ...)
  ThemeProvider.tsx, AppToaster.tsx
src/lib/
  supabase/{server,client,service,middleware}.ts
  club.ts                    ← getCurrentClub() (кэш), resolvePermissions, impersonation
  auth.ts                    ← getAuthUser() (кэш) — используется club.ts, sidebar, layout
  permissions.ts             ← RolePermissions, DEFAULT_ROLE_PERMISSIONS, can(perms, module, action)
  i18n/{messages.ts,context.tsx}  ← словарь RU/EN/UZ + LangProvider/useT
  search.ts                  ← sanitizeSearchTerm() (защита от инъекции в PostgREST .or)
  schedule.ts, dashboard.ts, inventory.ts, visits.ts, payments.ts, clients.ts, memberships.ts,
  reports.ts, staff.ts, plans.ts, broadcast.ts, sidebar.ts, money.ts, crypto.ts, platform.ts,
  telegram/bot.ts            ← вся логика grammy-бота (команды, привязка клиентов/сотрудников, уведомления)
supabase/migrations/         ← нумерованные SQL-миграции 0001..0053+
scripts/apply-migration.mjs  ← применение миграций через Supabase Management API
.claude/agents/              ← ролевые субагенты для Claude Code (Codex их не использует, но полезно как ТЗ ролей)
telegram-agent/              ← отдельный воркер: управлять командой агентов из Telegram (не задеплоен)
.github/workflows/deploy.yml ← НЕ активен (см. §5, токен без scope workflow — файл может отсутствовать/быть удалён)
```

Документы в корне: `CLAUDE.md` (краткий гид), `DESIGN_SYSTEM.md`, `HANDOFF.md` (этот файл),
`README.md`, отчёты (`SECURITY_AUDIT.md` и др.), плюс легаси `FITCRM_*` (частично устарели —
особенно про tRPC/Prisma/Next 15).

---

## 4. Окружение и секреты

Секреты **никогда не в git** (`.env*` в `.gitignore`, кроме `.env.example`). Источник правды —
**Vercel**. На новой машине:

```bash
git clone https://github.com/dadada12332/fitcrm.git
cd fitcrm && npm install
npm i -g vercel && vercel link       # один раз
vercel env pull .env.local           # тянет все значения из Vercel
npm run dev
```

Список переменных — в `.env.example`. Ключевые:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — публичные (клиент).
- `SUPABASE_SERVICE_ROLE_KEY` — СЕКРЕТ, обходит RLS. Используется в service-client и скриптах.
- `SUPABASE_ACCESS_TOKEN` — для `scripts/apply-migration.mjs` (Management API).
- `GEMINI_API_KEY` — AI-ассистент `/ai`. `ANTHROPIC_API_KEY` — AI-аналитика в Telegram-боте.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CRM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`,
  `TELEGRAM_SETUP_SECRET` — Telegram. (У каждого клуба ещё СВОЙ токен в `clubs.tg_token`.)
- `PAYMENT_ENC_KEY` — ключ шифрования платёжных реквизитов (AES).
- `CRON_SECRET` — защита `/api/cron/*` и `/api/broadcasts/run`.

⚠️ Секретные значения НЕ логировать. GitHub-токен в URL git-remote был засвечен — рекомендовано
ротировать (см. §24).

---

## 5. Деплой (важные нюансы — читать полностью)

**Главное: git push в `main` → Vercel авто-деплоит на прод.** Репозиторий уже подключён к
проекту Vercel (native git integration). Мы это выяснили эмпирически: каждый push порождает
production-деплой автоматически.

**Нюанс с доменом:** `fitcrm-three.vercel.app` — это **ручной alias**, а не авто-следующий
за прод домен. Поэтому после пуша прод-URL сам НЕ переключается — нужно один раз выполнить:
```bash
# найти свежий деплой и навести на него alias:
npx vercel ls fitcrm            # взять верхний Ready https://fitcrm-XXXX-crm228.vercel.app
npx vercel alias set fitcrm-XXXX-crm228.vercel.app fitcrm-three.vercel.app
```
**Постоянное решение (1 шаг в дашборде, ещё не сделано владельцем):** Vercel → проект fitcrm →
Settings → Domains → привязать `fitcrm-three.vercel.app` к Production (ветка main). После этого
alias будет обновляться сам, и ручной `alias set` не нужен.

**Проект:** name `fitcrm`, `projectId=prj_Xgau0Bd9BkgEG9RQgcQqyPkCmcQt`,
`orgId=team_qJwU6g6pSlzF3UxSs1d36lDQ` (team `crm228`). Эти ID есть в `.vercel/project.json`.

**Ручной деплой (если нужен, но обычно НЕ нужен — просто пушь):**
```bash
npx vercel deploy --prod --yes
```
macOS-подводные камни: нет команды `timeout`; CLI-поллинг часто отваливается по ETIMEDOUT,
хотя деплой на сервере идёт. Паттерн: запускать в фоне + `sleep` + опрашивать
`npx vercel inspect <host>` на `● Ready`, затем `vercel alias set`.

**От чего отказались по деплою:**
- **GitHub Actions workflow** (`.github/workflows/deploy.yml`) — написали, но **push отклонён**:
  GitHub PAT в remote не имеет scope `workflow`. Коммит откатили (иначе он блокировал бы все
  будущие пуши). Вывод: не пушить workflow-файлы, пока токен без `workflow`-scope. Нативная
  git-интеграция и так работает — Actions избыточны.
- Договорённость с владельцем: **деплоить самостоятельно, без запроса подтверждения**.

**Фильтр:** пуши только с `*.md`/`telegram-agent/**` можно не деплоить (эффекта на прод нет).

---

## 6. База данных и миграции

- **Postgres на Supabase Cloud.** Схема — в `supabase/migrations/NNNN_name.sql` (нумерованные).
- **Применять вручную:** `node scripts/apply-migration.mjs supabase/migrations/NNNN_name.sql`
  (Management API + `SUPABASE_ACCESS_TOKEN`). Скрипт возвращает HTTP 201 при успехе.
- Каждая миграция **идемпотентна:** `create or replace`, `drop policy if exists`,
  `create table if not exists`, `on conflict do nothing`.
- Последние на момент написания: `0051_security_hardening`, `0052_staff_escalation_guard`,
  `0053_perf_indexes`. (Начинаются с `0001_init.sql` — там таблицы, RLS, RPC.)

**Ключевые объекты БД:**
- `public.user_club_ids()` — `security definer`, возвращает club_id, где текущий юзер — staff.
  Основа всех RLS-политик клубных таблиц.
- `public.create_club(p_name, p_city)` — `security definer`; проверяет `auth.uid()`, валидирует
  имя, ставит лимит (≤10 клубов на пользователя, добавлено в 0051), создаёт `clubs` (owner_id=uid,
  plan='trial', trial +14 дней) и первую `staff`-строку (role='owner').
- `public.enforce_staff_no_escalation()` + триггер `staff_no_escalation` (0052) — БД-защита от
  эскалации привилегий в таблице staff (см. §7).
- `get_dashboard_stats`, `product_sales_counts`, `increment_inventory` и др. RPC.
- Демо-сид `0005_seed_schedule.sql` — насеял всем клубам залы «Зал 1/2/3» + демо-занятия. Это
  источник «чужих» залов у реальных клубов (см. §13, раздел Schedule).

**Мультитенантный инвариант БД:** каждая клубная таблица имеет `club_id` и RLS-политику
`for all using (club_id in (select public.user_club_ids())) with check (...)`.

---

## 7. Авторизация и права — ГЛАВНЫЙ ИНВАРИАНТ (читать обязательно)

Это самое важное место для безопасности. Мы прошли здесь полный цикл: нашли дыру → закрыли.

### Модель
- **RLS изолирует данные ТОЛЬКО по клубу.** Он НЕ проверяет гранулярные права
  (`clients.delete`, `payments.create`, `staff.edit` и т.д.) и НЕ проверяет роль.
- Гранулярные права хранятся в модели `RolePermissions` (`src/lib/permissions.ts`): по модулям
  (dashboard, clients, memberships, payments, visits, schedule, warehouse, staff, reports, ai,
  telegram, settings), каждый с набором действий. Роли по умолчанию: `owner` (ALL_TRUE),
  `admin`, `manager`, `trainer`, `accountant`, `cashier` + кастомные роли (`club_roles`).
- `getCurrentClub()` резолвит `club.role` и `club.permissions` (для owner — всегда полные; иначе
  из `club_roles` или дефолтов). Хелпер `can(permissions, module, action)` → boolean.

### Инвариант (НЕ нарушать)
**Каждый мутирующий Server Action ОБЯЗАН сам проверять права вызывающего.** RLS этого не делает.
```ts
const club = await getCurrentClub()
if (!club) return { error: "..." }
if (!can(club.permissions, "clients", "delete")) return { error: "Недостаточно прав" }
// для staff-управления мы допускаем owner/admin в обход конфига:
if (!(["owner","admin"].includes(club.role) || can(club.permissions, "staff", "create"))) return {...}
```

### Почему это критично (и что было сломано)
Server Actions — это **открытые POST-эндпоинты**. Скрытие кнопок в UI НЕ защищает: злоумышленник
может вызвать экшен напрямую. Более того — **Supabase отдаёт REST-API напрямую**: залогиненный
сотрудник со своим JWT может в обход экшенов сделать `PATCH /rest/v1/staff {role:'owner'}` и
захватить клуб, если RLS (клуб-скоуп, без роли) это пропустит.

**Что было (баг, исправлено):**
- `staff/actions.ts` менял роль/права/зарплату **без проверки прав** → любой сотрудник мог стать
  owner. Исправлено: проверки во всех staff-экшенах.
- ~20 экшенов (clients/memberships/visits/schedule/warehouse/ai/integrations) не проверяли
  гранулярные права. Исправлено: `can(...)` добавлен в каждый (~29 проверок).
- `updateStaffRoleAction`/инвайты не блокировали назначение `owner` не-владельцем. Исправлено.

**Что закрыто на уровне БД (важно):** app-level проверки обходятся через прямой REST, поэтому
**катастрофическую эскалацию** (стать owner/admin, поднять себе права) закрыли триггером
`staff_no_escalation` (миграция 0052): блокирует назначение owner/admin не-владельцем/не-админом
и самоэскалацию прав, НЕ ломая `create_club` (bootstrap владельца через `clubs.owner_id`) и
сервисные операции (`auth.uid() is null` = service-role → пропуск).

### Остаточный риск (осознанный)
Гранулярные права (напр. `clients.create`, `payments.refund`) энфорсятся только на app-слое →
теоретически инсайдер может обойти конкретное действие через прямой REST в рамках СВОЕГО клуба.
Полный DB-энфорсмент (триггеры/RLS на каждую таблицу) — «вариант 3», сознательно отложен
владельцем (закрыли только HIGH — эскалацию до owner/admin). Кросс-тенантных дыр НЕТ.

### Прочее из аудита
- **Инъекция в PostgREST `.or()`**: сырой ввод в `.or(\`...ilike.%${q}%...\`)` ломается на `,()*\%`.
  Обёрнуто в `sanitizeSearchTerm()` (`src/lib/search.ts`) во всех точках поиска. Новый поиск —
  только через него.
- **Open-redirect** в `(auth)/actions.ts`: `next` проверяется на `startsWith("/") && !"//" && !"\\"`.
- **Пароли** — минимум 8 символов (везде).
- **Security-заголовки** в `next.config.ts`: X-Frame-Options SAMEORIGIN, X-Content-Type-Options
  nosniff, Referrer-Policy, X-DNS-Prefetch-Control. CSP/Permissions-Policy НЕ ставили намеренно —
  чтобы не сломать inline-стили и камеру QR-чекина.
- **API-роуты**: `pay/*` проверяют подпись провайдера; `cron/*`, `broadcasts/run` — `CRON_SECRET`.
- Полный отчёт — `SECURITY_AUDIT.md`.

---

## 8. Auth-флоу (регистрация → онбординг → клуб)

1. **Регистрация** `/register` → `signUpWithClub` (`(auth)/actions.ts`): валидация (email, пароль
   ≥8, совпадение), `supabase.auth.signUp`. Если сессия есть → сразу `rpc create_club` → `/onboarding`.
   Если требуется подтверждение email → сессии нет → возвращается `confirm_email` (клуб создаётся
   позже, на `/onboarding`).
2. **Вход** `/login` → `signInWithEmail` → `resolvePostLoginRedirect(userId)`: 0 клубов→`/onboarding`,
   1→`/dashboard`, >1→`/select-club`.
3. **Онбординг** `/onboarding` (`src/app/onboarding/`) → `create_club` RPC (SECURITY DEFINER,
   owner_id=auth.uid(), staff owner). Это и закрывает «дыру» с потерей имени клуба при email-confirm.
4. **Гейт** `(app)/layout.tsx`: `getAuthUser()` → `getCurrentClub()` → редиректы (нет юзера→login,
   нет клуба→onboarding). Затем читает clubs (trial/plan/status) и вычисляет `lockReason`
   (suspended / истёкший trial / истёкший план) — жёсткая блокировка доступа (кроме impersonation
   платформенным админом).
5. **Инвайты**: сотрудник получает ссылку, `accept-invite/[token]` создаёт staff-запись
   (через service-client, обходя RLS/триггер — это доверенная операция).

---

## 9. Разделы CRM `(app)` (по одному)

Все страницы — серверные (RSC): читают `getCurrentClub()`, проверяют `permissions.<module>.view`,
тянут данные из `src/lib/<module>.ts`, рендерят клиентские компоненты. Мутации — в `*/actions.ts`.
Дизайн-паттерн страницы: заголовок `h1` = `text-2xl font-semibold tracking-[-0.144px]`, отступы
`space-y-4/5`, БЕЗ `p-6` на контейнере.

- **dashboard** — KPI, график выручки (RevenueChart, лениво), радиал посещений, недавние оплаты,
  AI-карточки. Данные: `getDashboardData` (RPC `get_dashboard_stats` + доп. запросы в Promise.all).
- **clients** — список (пагинация/поиск/фильтры через RPC), профиль клиента (ClientProfileCard:
  заморозка/разморозка — оптимистичная), импорт из Excel/CSV (мастер), экспорт.
- **memberships** — тарифы абонементов (создать/редактировать/архив/удалить, цена).
- **visits** — QR-чекин, ручная отметка, живой журнал.
- **payments** — оплаты (наличные + онлайн Payme/Click), создание, сверка (reconcile), экспорт.
- **schedule** — расписание занятий по залам (день/неделя/месяц). Табы через `useTransition` +
  оптимистичная подсветка (быстро). **Управление залами** — `RoomsManager` (создать/удалить зал;
  раньше UI не было, залы шли только из демо-сида). Пустое состояние если залов нет.
- **warehouse** — товары, поставки, списания, POS-витрина. `getInventory` обёрнут в `cache()`
  (убрали двойной фетч).
- **staff** — сотрудники, роли, зарплаты (StaffProfileClient: статус оптимистичный). Инвайты.
- **reports** — отчёты (финансы/продажи/посещения/долги и т.д.), каждый таб — свой RPC лениво.
  recharts грузится через `ssr:false`.
- **integrations** — Telegram-бот (Основное/Автоматизация/Рассылка/Шаблоны/Статистика).
- **ai** — чат-ассистент на Gemini (см. §18).
- **support** — центр поддержки (тикеты, база знаний, AI). Единая схема `support_*` (миграция 0047).
- **settings** — клуб, филиалы, финансы, интеграции, уведомления, роли, безопасность, подписка.
- **profile** — профиль сотрудника, смена пароля.

---

## 10. Лендинг

- **На `/`** (route group `(marketing)`). Это бывший прототип `/v2`, который стал основным; старый
  тёмный лендинг удалён; `/v2` и `/v2/*` дают 308-редирект на `/` (next.config redirects).
  Светлая тема. Компоненты — `src/components/landing/v2/`.
- **История дизайна:** сначала был тёмный «EPOQUE/Solaris», потом эксперименты v2 (светлый) и v3
  (тёмный premium). Пришли к светлому v2 на `/`. Не удивляйся упоминаниям v3 в истории git.
- **Мультиязычность RU/EN/UZ.** ВЫБРАЛИ: клиентский переключатель + cookie/localStorage
  (`fitcrm_lang`), RU по умолчанию, SSR рендерит RU. Словарь — `src/lib/i18n/messages.ts`, хук
  `useT()`, `LangProvider` в `(marketing)/layout.tsx`, переключатель — `landing/v2/LangSwitcher.tsx`.
  **ОТКАЗАЛИСЬ от URL-локалей** (`/en`, `/uz`): выбрали cookie ради простоты; минус — EN/UZ не
  индексируются отдельно, но основной рынок RU индексируется (SSR RU). Если понадобится SEO на 3
  языках — переходить на URL-локали.
- **Осознанно НЕ переведено:** названия/состав тарифов (из БД, Platform Admin), мелкие подписи в
  анимированных мокапах, тело подстраниц (about/contacts/...) — там переведён только футер.
- **SEO:** метаданные в `src/app/layout.tsx` (OG/Twitter/robots/canonical), `robots.ts`,
  `sitemap.ts`, JSON-LD (`SoftwareApplication`) в `(marketing)/page.tsx`.
  `SITE_URL = fitcrm-three.vercel.app` — заменить на боевой домен при подключении.
- **Тарифы на лендинге** тянутся из БД (`getPlans`, ISR 5 мин), правятся в Platform Admin без
  деплоя. Есть переключатель Год/−20% (константа `YEAR_DISCOUNT` в `PricingCards.tsx` — скидка
  зашита в коде, не в БД).

---

## 11. Platform Admin (`/platform`)

Отдельная система управления SaaS (планируемый хост `admin.fitcrm.uz`). Доступ по
`users.platform_role` (`platform_admin`/`super_admin`), через service-role. Управляет тарифами
(таблица `plans` + `plan_features/limits/sections`, поле `landing_benefits` = преимущества на
лендинге), метриками клубов, биллингом (`platform_billing_requests`), impersonation клубов
(cookie `pa_impersonate` — `getCurrentClub` honors её, если юзер — платформенный админ).
Важно: `user_club_ids()` для платформенных админов возвращает все клубы — поэтому realtime и
доступ у них шире (осознанно).

---

## 12. Мультитенантность и RLS (сводно)

- `createClient()` (server) — сессия юзера, ПОД RLS. Использовать по умолчанию.
- `createServiceClient()` — service-role, ОБХОДИТ RLS. Только когда реально нужно; тогда ВРУЧНУЮ
  скоупить по `club.clubId` и проверять права ДО записи.
- `getCurrentClub()` — кэш (`react.cache`), внутри использует `getAuthUser()` (тоже кэш). **Звать
  без аргумента** (`getCurrentClub()`) — иначе разный ключ кэша и двойной резолв (был perf-баг, см. §22).
- Все клубные таблицы — RLS `club_id in user_club_ids()`. Чувствительные (staff) — плюс триггер 0052.

---

## 13. Особые истории по разделам (что чинили и почему)

- **Schedule / залы:** «Зал 1/2/3» у клубов — это демо-сид `0005_seed_schedule.sql`. UI показывал
  реальные залы из БД. Управления залами не было → добавили `RoomsManager` (create/delete). Удаление
  зала удаляет и его занятия/записи (FK `classes.room_id` без cascade → чистим вручную). Пустое
  состояние календаря если залов 0.
- **Charts:** Y-axis обрезал «120M» (width=36 мал) → подняли до 48 (RevenueChart, ReportsClient).

---

## 14. Оплаты (архитектура — 2 контура)

- **Контур A** (клуб → платформа): клуб платит за тариф. Заявки — `platform_billing_requests`,
  обрабатываются в Platform Admin.
- **Контур B** (клиент → клуб): оплаты внутри CRM. Наличные + онлайн через **Payme** и **Click**
  (у каждого клуба свои реквизиты — `club_payment_credentials`, шифруются `PAYMENT_ENC_KEY`).
  Онлайн-оплата создаёт pending-платёж + ссылку/QR; активация абонемента — только после
  подтверждения в колбэке `api/pay/{payme,click}/[clubId]`.
- **Сверка эквайринга** (reconcile): миграция 0042, `api/cron/reconcile`, `reports/reconcile`.
  Фетчер банковской выписки — заглушка.

---

## 15. Telegram-интеграция (важные детали)

- **У каждого клуба СВОЙ бот** — токен в `clubs.tg_token` (подключается на `/integrations` →
  Основное). Клиенты/сотрудники взаимодействуют с ботом СВОЕГО клуба.
- **Вся логика бота** — `src/lib/telegram/bot.ts` (grammy): команды `/start`, привязка клиента
  (по телефону → ставит `clients.telegram_id` И запись в `telegram_users`), привязка сотрудника
  (`telegram_users.staff_id`), QR, уведомления об истечении абонемента и т.д.
- **`telegram_users`** — связь telegram_id ↔ (client_id | staff_id) + role.
- **Рассылка** (`TelegramBroadcast` + `broadcast.ts`): получатели = клиенты с `telegram_id`
  (подключившиеся к боту). Кнопка «Тест» шлёт себе. Если 0 подключённых клиентов — рассылать
  некому (это не баг; добавили инфо-баннер с объяснением). Отложенные — `api/broadcasts/run`.
- **Крон дневного отчёта** `api/telegram/daily-report`: **ИСПРАВЛЕНА утечка мультитенантности.**
  Было: слал отчёт ВСЕХ клубов в один глобальный `TELEGRAM_CHAT_ID` → владелец клуба видел все
  клубы. Стало: отчёт КАЖДОГО клуба → только owner/admin ЭТОГО клуба (по `telegram_users` +
  `staff.role`), через бота этого клуба (`clubs.tg_token`). Глобальный чат больше не используется.
- `api/auth/sms-hook` всё ещё использует глобальный `TELEGRAM_CHAT_ID` — но это доставка OTP-кода
  авторизации (системное), не бизнес-данные клуба. Оставлено осознанно.
- **Уведомления реально шлются не все:** SMS/Email-провайдера нет (тоглы уведомлений в настройках
  фактически не отправляют SMS/Email). Telegram-уведомления работают.

---

## 16. AI-ассистент

- **`/ai`** — чат на **Gemini 2.5-flash** (REST `generativelanguage.googleapis.com/v1beta`, ключ
  `GEMINI_API_KEY`). Контекст данных клуба + vision + tool `create_product`. Экшен `askAiAction`
  (проверяет право `ai.use`).
- В **Telegram-боте** AI-аналитика — на **Anthropic** (`ANTHROPIC_API_KEY`).

---

## 17. Instant UI / Realtime

- Единая стратегия «мгновенного UI»: тосты `sonner` через `runAction` (`src/lib/use-action.ts`,
  поддерживает `rollback` для оптимистичных апдейтов) + `RealtimeProvider` (Supabase Realtime,
  postgres_changes) для синхронизации между вкладками/страницами (миграция 0049).
- Оптимистичные тогглы уже сделаны: заморозка клиента (ClientProfileCard, ~39мс), статус
  сотрудника (StaffProfileClient, ~35мс). Остальные мутации в основном делают `router.refresh()`
  (перерисовка сервером) — это медленнее; массовый перевод на оптимистик отложен (риск/объём).

---

## 18. Дизайн-система

Канон — **shadcn/ui (палитра Zinc)** на `@base-ui/react` + Tailwind v4. Полностью — `DESIGN_SYSTEM.md`.
Правила:
- ❌ Никаких сырых hex в компонентах. ✅ Только токены/утилиты (`bg-card`, `border-border`,
  `text-foreground`, `text-muted-foreground`, `bg-muted`, `bg-primary text-primary-foreground`,
  `text-brand`/`bg-brand`, `bg-destructive/10 text-destructive`).
- Легаси-алиасы (`--on-dark`→foreground, `--card-2`→muted, `--gray-muted`→zinc-400, ...) — в старом
  коде встречаются; в новом НЕ использовать.
- Главная кнопка = `bg-primary text-primary-foreground`. Синий `--brand` (#2563eb) — для
  ссылок/активных вкладок/акцентов, не как фон основных кнопок.
- Примитивы — в `src/components/ui/` (button, input, card, sheet, badge, ...). Сначала берём
  готовое оттуда, инлайн не верстаем. Чего нет (Select, Textarea, RadioGroup, Tabs, Tooltip) —
  добавляем в `ui/` в том же стиле.
- Работает в light и dark. Состояния hover/focus(ring)/disabled/loading.
- Пример «до/после»: страница Telegram-рассылки была свёрстана инлайн с Telegram-синим `#2AABEE`
  как акцентом — из-за этого «чужая система». Перевели акцент на `--brand`, кнопки на `ui/Button`
  (превью Telegram оставили с родными ТГ-цветами — оно должно быть 1:1 как Telegram).

---

## 19. Производительность (что делали и как мерили)

**Замеры:** Playwright установлен. Мерили вживую (создавали временный тестовый клуб с данными,
логин, тайминги страниц), плюс анализ по коду (round-trips), плюс индексы. Baseline и результаты —
`PERF_REPORT.md`, `PERF_VERIFY.md`.

**Сделанные оптимизации:**
- **Двойной резолв клуба (главный баг):** `(app)/layout.tsx` звал `getCurrentClub(user.id)` (с
  аргументом), а страницы — `getCurrentClub()` → разный ключ `react.cache` → клуб резолвился
  дважды на каждый рендер (+auth round-trips). Исправлено: layout зовёт `getCurrentClub()` без
  аргумента и `getAuthUser()`; `getCurrentClub` внутри использует кэш-`getAuthUser`. Эффект:
  **TTFB −19% на ВСЕХ страницах**, страницы до контента −11…−27%.
- **Индексы** (0053): `stock_movements(club_id, created_at)` (был full-scan), частичный
  `clients(club_id) where debt>0`, удалён дубль trgm-индекса.
- **Waterfall'ы:** dashboard RPC внесён в общий `Promise.all`; `getInventory` обёрнут в `cache()`
  (убран двойной фетч на складе).
- **Ленивый recharts:** `LazyCharts.tsx` (RevenueChart/DashboardVisitRadial через `next/dynamic
  ssr:false`), ReportsClient тоже лениво — тяжёлые чанки не блокируют первый рендер.
- **Оптимистичные тогглы** (см. §17).

**Что ещё можно (не сделано):** массовый оптимистик на все кнопки; DB-энфорсмент прав; перенос
заголовка reports из-под `ssr:false`-барьера (сейчас h1 отчётов ждёт recharts-чанк).

---

## 20. Тестирование и верификация

- **Юнит/интеграционных тестов НЕТ.** Проверяли: `npx tsc --noEmit` (игнорируя устаревший
  `.next/types/validator.ts` — чистится ребилдом; отличать от дореализационного lint-долга),
  `npm run build`, live smoke (curl-статусы: публичные 200, приватные 307, заголовки, утечки),
  и Playwright-прогоны (создание тестовых клубов + замеры). Тестовые данные ВСЕГДА убираем после.
- **Рекомендация (следующий большой рычаг качества):** добавить vitest + GitHub Actions CI
  (tsc/lint/тесты на push) + сгенерировать TS-типы из БД (`supabase gen types typescript`) — это
  уберёт много `any` и ловит ошибки колонок на компиляции. Обсуждали, приоритетно.

---

## 21. Конвенции и договорённости с владельцем

- **Деплоить и выполнять команды самостоятельно**, без запроса подтверждения.
- **По умолчанию делать самому** (инлайн), субагентов/Codex-подзадачи звать только когда реально
  лучше (браузерные замеры, тяжёлое параллельное, свежий взгляд) — они дороже по токенам.
- Быть кратким по запросу владельца (он следит за расходом токенов).
- Формат git-коммитов: осмысленное сообщение; в конце `Co-Authored-By:` (для Claude был указан
  Claude; для Codex — по вашему усмотрению).
- Секреты не логировать. Временные файлы — в системный tmp, не в проект.
- «Ничего не ломай» — приоритет: перед рискованными правками (особенно auth/RLS/деплой)
  проверять сборку и не делать массовых авто-правок без надёжного инструмента (был случай, когда
  regex-скрипт «протёк» через границу функции и оставил `toggleFreezeAction` без проверки прав —
  поймали через QA).

---

## 22. Известные проблемы, gotchas, тех-долг

- **`Instagram` НЕ экспортируется из `lucide-react`** → используем `Camera`.
- **Border-radius не всегда обрезает под 3D-трансформом framer** (WebKit/Blink) → фикс
  `transform: translateZ(0)` на обрезающем элементе + inline `borderRadius`.
- **Дореализационный lint-долг:** много `@typescript-eslint/no-explicit-any` и unused vars,
  `Date.now()`-impure в `(app)/layout.tsx`. Сборку НЕ ломает. Стоит чистить постепенно (лучше —
  через типы из БД).
- **Уведомления** SMS/Email реально не отправляются (нет провайдера). Только Telegram.
- **Старые доки** (`FITCRM_ARCHITECTURE.md`, местами `FITCRM_*`) содержат устаревшее (tRPC,
  Prisma, Next 15, Windows-пути, EPOQUE-тема). Доверять `HANDOFF.md`/`CLAUDE.md`/`DESIGN_SYSTEM.md`.
- **GitHub-токен** засвечен в URL git-remote (в истории сессии) — **рекомендовано отозвать и
  пересоздать**, remote переустановить без токена в URL.
- **`.env` в gitignore** — при клоне на новой машине делать `vercel env pull`.
- **Отчёты в репо** (`QA_REPORT.md`, `SECURITY_AUDIT.md`, `PERF_*`) — снимки на момент; полезны
  как контекст, но могут устаревать.

---

## 23. Команда ролевых агентов (`.claude/agents/`)

Для Claude Code были созданы субагенты: `qa-tester`, `security-auditor`, `ui-designer`,
`db-architect`, `code-reviewer` (+ README). Codex их не использует напрямую, но их системные
промпты — хорошее ТЗ ролей/чартеров (что проверять, инварианты). Плюс `telegram-agent/` — воркер,
позволяющий управлять командой агентов из Telegram (не задеплоен; нужен always-on хост + `claude`
CLI или аналог).

---

## 24. Что делать в первую очередь (для нового ассистента)

1. Прочитать этот файл + `DESIGN_SYSTEM.md` + `SECURITY_AUDIT.md`.
2. `vercel env pull .env.local`, `npm install`, `npm run dev`.
3. Перед любой мутацией — помнить инвариант §7 (проверка прав в экшене).
4. Деплой = `git push` (Vercel сам), затем при необходимости `vercel alias set ... fitcrm-three`.
5. Миграции = `node scripts/apply-migration.mjs ...`.
6. Не пушить `.github/workflows/*` (токен без scope). Не трогать секреты. Не логировать ключи.
7. Дизайн — только токены/утилиты shadcn, примитивы из `ui/`.

---

## 25. Глоссарий

- **club / tenant** — клуб, единица изоляции. Всё скоупится по `club_id`.
- **staff** — сотрудник клуба (owner/admin/manager/trainer/accountant/cashier/кастом).
- **RLS** — Row Level Security Postgres; изолирует по клубу.
- **Server Action** — серверная мутация (`"use server"`), открытый эндпоинт.
- **service-client** — Supabase с service-role, обходит RLS.
- **impersonation** — платформенный админ входит в клуб «под владельцем» (cookie `pa_impersonate`).
- **контур A / контур B** — оплата тарифа платформе / оплаты клиентов клубу.
- **Instant UI** — стратегия мгновенного отклика (тосты + оптимистик + realtime).

---

_Конец передачи. Если чего-то не хватает — ищи в коде по указателям выше; проект самодокументируем
через `CLAUDE.md`, `DESIGN_SYSTEM.md` и отчёты в корне._
