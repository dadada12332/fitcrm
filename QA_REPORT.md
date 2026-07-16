# QA Report — FitCRM

Прогон QA-инженера. Прод: https://fitcrm-three.vercel.app
Начало: 2026-07-16 11:06:11 +05

---

## 1. Трассировка сценария по коду

Путь: регистрация → онбординг → create_club → гейт (app)/layout → разделы.

- `src/app/(auth)/actions.ts::signUpWithClub` (L25-51): валидация (email/password/clubName обяз., password ≥8, confirm==password) → `supabase.auth.signUp`. Если нет `data.session` (требуется подтверждение email) → возврат `confirm_email`, клуб НЕ создаётся. Если сессия есть → `rpc("create_club", {p_name: clubName})` → `redirect("/onboarding")`.
- `src/app/onboarding/actions.ts::saveClubInfoAction` (L22-55): `getClubId()` ищет active staff. Если клуба нет (сценарий подтверждения email) → `create_club` создаётся здесь + апдейт settings(address,phone). Если есть → апдейт name/settings. **Нет дубля клуба** — идемпотентно.
- RPC `create_club` — SECURITY DEFINER, `search_path=public`. `0001_init.sql` L397 (базовая) переопределяется `0051_security_hardening.sql` L10 (актуальная): требует `auth.uid()` (иначе `not authenticated`), валидирует имя (непустое, ≤120), **лимит 10 клубов-owner на юзера** (антифарм триалов). Вставляет users→clubs(plan='trial', trial_expires_at=now()+14d)→staff(role='owner'). grant execute только `authenticated`.
- Гейт `src/app/(app)/layout.tsx` (L9-63): `auth.getUser()` иначе `/login`; `getCurrentClub()` иначе `/onboarding`; читает clubs.status/trial_expires_at/plan_expires_at (fallback без status). Блокировка: suspended / trial истёк / plan истёк. Impersonation обходит блокировку.

**Логические разрывы:** не выявлено критичных. Отмечено:
- signUpWithClub при email-confirm возвращает `confirm_email` — клуб создаётся позже в онбординге (корректно, дубля нет).
- create_club определён дважды; актуальна версия из 0051 (последняя применённая перекрывает). ОК.

Статус: PASS (трассировка, разрывов нет).

## 2. Сборка и типы

- `npx tsc --noEmit` → **EXIT 0**, вывод пуст. Реальных ошибок типов нет. (PASS)
- `npm run build` → см. раздел ниже (см. раздел 2b).

## 3. Live smoke (неразрушающие GET) — 2026-07-16 11:06:59 +05

| Категория | Путь | Ожидалось | Факт | Статус |
|---|---|---|---|---|
| public | / | 200 | 200 | PASS |
| public | /about | 200 | 200 | PASS |
| public | /contacts | 200 | 200 | PASS |
| public | /docs | 200 | 200 | PASS |
| public | /blog | 200 | 200 | PASS |
| public | /terms | 200 | 200 | PASS |
| public | /privacy | 200 | 200 | PASS |
| public | /login | 200 | 200 | PASS |
| public | /register | 200 | 200 | PASS |
| public | /robots.txt | 200 | 200 | PASS |
| public | /sitemap.xml | 200 | 200 | PASS |
| private | /dashboard | 307 | 307 | PASS |
| private | /staff | 307 | 307 | PASS |
| private | /settings | 307 | 307 | PASS |
| private | /platform | 307 | 307 | PASS |
| leak | /.env.local | нет контента | 307 (redirect, без контента) | PASS |
| leak | /.git/config | нет контента | 307 (redirect, без контента) | PASS |

Security-заголовки на `/`:
- referrer-policy: strict-origin-when-cross-origin — PASS
- strict-transport-security: max-age=63072000; includeSubDomains; preload — PASS
- x-content-type-options: nosniff — PASS
- x-frame-options: SAMEORIGIN — PASS

Все 4 требуемых заголовка присутствуют. Утечек .env.local/.git/config нет. Статус раздела: PASS.

## 2b. Результат сборки

`npm run build` → **BUILD_EXIT 0**. Next.js 16.2.7 (Turbopack): "Compiled successfully in 16.2s", TypeScript OK (21.4s), 53 static pages сгенерированы, все роуты собраны (app + platform + api). Реальных ошибок сборки нет. Дореализационный lint-долг (any/unused) сборку не ломает. Статус: PASS.

## 4. Live e2e — создание 2 тестовых клубов (2026-07-16 11:08:36 +05)

Методика: service-role `auth.admin.createUser(email_confirm:true)` → anon `signInWithPassword` → `userClient.rpc("create_club")` (от имени юзера, т.к. SECURITY DEFINER + auth.uid()) → верификация service-клиентом.

| Клуб | Шаг | Результат | Статус |
|---|---|---|---|
| 1 | createUser | user id=ddd6f8c3…9159b62 | PASS |
| 1 | signIn (session) | session=true | PASS |
| 1 | create_club | club_id=b3533f5c…2ba7d6 | PASS |
| 1 | clubs.owner_id==user | совпадает | PASS |
| 1 | clubs.plan=='trial' | trial | PASS |
| 1 | trial_expires_at≈now+14д | 14.00 дней | PASS |
| 1 | staff.role=='owner' | owner | PASS |
| 2 | createUser | user id=309ce9c9…5257e83b | PASS |
| 2 | signIn (session) | session=true | PASS |
| 2 | create_club | club_id=c86e1b19…6745d8b3 | PASS |
| 2 | clubs.owner_id==user | совпадает | PASS |
| 2 | clubs.plan=='trial' | trial | PASS |
| 2 | trial_expires_at≈now+14д | 14.00 дней | PASS |
| 2 | staff.role=='owner' | owner | PASS |

### Изоляция мультитенантности (RLS)
User-клиент клуба №1 читает данные клуба №2:
- `clubs` по club_id клуба №2 → 0 строк → **PASS**
- `staff` по club_id клуба №2 → 0 строк → **PASS**
- `clients` по club_id клуба №2 → 0 строк → **PASS**

RLS изолирует данные между тенантами корректно (без ошибок PostgREST — просто пустая выборка, как и ожидается для `for all using (club_id in user_club_ids())`).

## 5. Уборка тестовых данных — 2026-07-16 11:08:36 +05

Service-клиентом удалено: staff → clubs → auth.admin.deleteUser, для обоих клубов.

| Клуб | clubs осталось | staff осталось | user удалён | Статус |
|---|---|---|---|---|
| 1 (club b3533f5c…, user ddd6f8c3…) | 0 | 0 | YES | PASS |
| 2 (club c86e1b19…, user 309ce9c9…) | 0 | 0 | YES | PASS |

Временный node-скрипт удалён. Боевая БД чиста.

---

## Итог

**Вердикт: PASS.** Все проверенные разделы зелёные.

Счёт: 14 e2e PASS / 0 FAIL; 17 smoke-строк PASS / 0 FAIL; 4/4 security-заголовка; tsc EXIT 0; build EXIT 0. Итого 0 FAIL.

### Баги
Не найдено (severity none). Ни функциональных, ни security-регрессий в проверенном объёме.

### Наблюдения (не баги)
- `create_club` определён в 0001_init.sql и переопределён в 0051_security_hardening.sql (лимит 10 клубов/owner, валидация имени ≤120). Применяется актуальная версия. ОК.
- `/.env.local` и `/.git/config` отдают 307 (middleware-редирект, не 404) — контента нет, утечки нет; но 404 был бы чище семантически. Инфо, не баг.

### Создавалось / убрано на боевой БД
Создано и полностью удалено 2 тестовых клуба + 2 тестовых юзера:
- club b3533f5c-5d80-45a7-840a-7b991b2ba7d6 / user ddd6f8c3-2c72-4624-b0f5-c629f9159b62 — УДАЛЕНО
- club c86e1b19-e5c9-4b6e-aba1-51e76745d8b3 / user 309ce9c9-06b5-4453-891a-4a0c5257e83b — УДАЛЕНО
Реальные клубы/пользователи/код не затронуты.

### Что НЕ проверено (и как проверить)
- **Авторизованные UI-клики без браузера**: реальный рендер /dashboard, /clients, /staff под сессией, формы онбординга (OnboardingWizard), создание клиента/абонемента/оплаты через UI. Нужен headless-браузер (Playwright уже в deps, тестов нет) с реальным логином.
- **Проверка гранулярных прав в мутирующих Server Actions** (инвариант §7): не покрыто — нужны негативные e2e от имени юзера с урезанными permissions.
- **Флоу подтверждения email** (`confirm_email` ветка signUpWithClub → создание клуба в онбординге): не эмулировался (создавали юзеров с email_confirm:true).
- **Google OAuth, phone OTP, accept-invite, платежи (Payme/Click), Telegram, AI** — не проверялись.
- **Блокировки гейта** (suspended/trial expired/plan expired) — только по коду, не прогонялись live.

Конец отчёта.
