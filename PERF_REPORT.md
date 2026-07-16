# FitCRM — Performance Baseline & Bottleneck Report

**Дата:** 2026-07-16
**Метод:** Playwright (headless chromium) против прод `https://fitcrm-three.vercel.app`, под логином тестового клуба с реалистичными сид-данными (80 clients, 8 memberships, 40 subscriptions, 50 payments, 40 visits, 15 products, 10 schedules/classes). По 3 прогона на страницу, взята медиана. Тестовый клуб и юзер **удалены после замеров** (0 остаточных строк подтверждено).
**Замеры — «тёплые» прод-загрузки** (Vercel edge + Supabase уже прогреты). Это baseline, не худший случай.

> Код в этом заходе **не менялся** — только измерение и анализ.

---

## 1. Baseline: страницы (медиана из 3, мс)

| Страница | TTFB | DOMContentLoaded | load | Контент (goto→ключевой селектор) | Вердикт |
|---|---:|---:|---:|---:|---|
| /dashboard | 146 | 2701 | 2701 | **2764** | 🔴 медленно |
| /staff | 156 | 2457 | 2486 | **2494** | 🔴 медленно |
| /visits | 158 | 2231 | 2257 | **2324** | 🟠 средне |
| /warehouse | 159 | 2115 | 2257 | **2208** | 🟠 средне |
| /payments | 155 | 2073 | 2102 | **2169** | 🟠 средне |
| /clients | 157 | 2098 | 2099 | **2167** | 🟠 средне |
| /settings | 166 | 2480 | 2497 | **1997** | 🟠 средне |
| /reports | 172 | 1710 | 1917 | **1804** | 🟢 ок |
| /memberships | 151 | 1825 | 1874 | **1847** | 🟢 ок |
| /schedule | 164 | 1662 | 1691 | **1737** | 🟢 ок |

**Ключевое наблюдение:** TTFB везде низкий и ровный (**146–172 мс** — edge/стриминг отдаёт заголовки быстро). Всё время уходит в интервал **TTFB → контент ≈ 1.6–2.6 с**. Это НЕ база данных на заголовках, а сумма: (а) серверный waterfall в общем layout до стриминга и (б) вес клиентского JS (парс/выполнение/гидрация). Даже `/dashboard`, который стримит тело под Suspense, платит полную стоимость layout до первого байта тела.

### Публичный лендинг `/` (cold vs warm)
| Прогон | TTFB | Полная отрисовка (wall) |
|---|---:|---:|
| 1 (cold / ISR-miss) | 213 | ~2023 |
| 2 (warm) | 232 | ~415 |
| 3 (warm) | 208 | ~388 |

TTFB стабилен; «холодная» первая загрузка ~2 с — прогрев ISR/edge, далее ~0.4 с. Лендинг в норме.

---

## 2. Ранжированные узкие места (причины по коду)

### 🔴 #1. Серверный waterfall в общем layout — платят ВСЕ страницы `/app`
`src/app/(app)/layout.tsx:11-44` выполняет строго последовательно:
1. `supabase.auth.getUser()` (:11) — валидация JWT по сети (~150 мс)
2. `getCurrentClub(user.id)` (:14) — join `staff+clubs` (+ запрос прав для не-owner)
3. `supabase.from("clubs").select(...).maybeSingle()` (:19) — **повторный** запрос клуба (trial/plan/status), хотя `getCurrentClub` уже тянул `clubs(name, plan)`
4. `getSidebarStats(...)` (:44) — внутри ещё один `getAuthUser()` (`src/lib/sidebar.ts:27`) серийно перед своим `Promise.all` из 7 запросов

Это последовательная цепочка сетевых round-trip'ов ДО того, как начнёт рендериться любая страница (включая стриминговый дашборд).
**Рекомендация:** (1) запустить запрос статуса клуба (:19) параллельно с `getSidebarStats` через `Promise.all`; (2) вообще убрать его — забирать `status/trial_expires_at/plan_expires_at` внутри `getCurrentClub` одним `clubs`-запросом и вернуть; (3) в `getSidebarStats` убрать серийный `getAuthUser` (:27) — `userId` уже передан, аватар-мету взять из уже полученного user.

### 🔴 #2. `getCurrentClub` выполняется дважды за запрос (промах React.cache)
`src/lib/club.ts:17` обёрнут в `cache(...)`, но **ключ кэша = аргумент**. Layout зовёт `getCurrentClub(user.id)`, а страницы (`clients/page.tsx:19`, `payments/page.tsx:26`, `staff/page.tsx:9`, `warehouse/page.tsx:12`, …) зовут `getCurrentClub()` **без аргумента** → другой ключ → полная переотработка: ещё один `auth.getUser()` + join `staff+clubs` (+ права). Итого ~**3 вызова `auth.getUser()` и 2 резолва клуба на каждую страницу**.
**Рекомендация:** звать `getCurrentClub()` **без аргумента везде** (и в layout тоже), а внутри использовать `getAuthUser()` (уже кэширован в `src/lib/auth.ts`). Тогда один резолв на запрос.

### 🔴 #3. Дашборд: RPC не в `Promise.all` (waterfall)
`src/lib/dashboard.ts:170` — `await supabase.rpc("get_dashboard_stats", ...)` выполняется **до** батча из 5 параллельных запросов на `:172`. RPC и батч идут последовательно, хотя независимы.
**Рекомендация:** включить `rpc("get_dashboard_stats")` в тот же `Promise.all`, что и debt/todayClients/todayPayments/birthdays/oldPayments.

### 🔴 #4. Склад: `getInventory` тянется дважды + serial RPC
`src/app/(app)/warehouse/page.tsx:16` параллелит `getPosProducts`, `getInventoryStats`, `getRecentMovements`. Но `getPosProducts` (`src/lib/inventory.ts:75`) **и** `getInventoryStats` (`src/lib/inventory.ts:87`) каждый независимо вызывают `getInventory` (join `products+inventory`) → тот же тяжёлый запрос **2 раза**. Плюс в `getPosProducts` (`inventory.ts:77`) RPC `product_sales_counts` идёт **серийно после** `getInventory`.
**Рекомендация:** получить `getInventory` один раз выше, передать в оба потребителя; RPC `product_sales_counts` параллелить с базовым списком.

### 🟠 #5. Отсутствующие индексы БД
Проверено на живой БД (`pg_indexes`):
- **`stock_movements` — вообще НЕТ индекса по `club_id`** (только PK). Каждый запрос склада (`getInventoryStats` фильтр `club_id+type+created_at`; `getRecentMovements` `order by created_at`) идёт full-scan. → добавить `create index idx_stock_movements_club_created on stock_movements(club_id, created_at desc)` и/или `(club_id, type, created_at)`.
- **`clients.birth_date` — запрос дня рождения** `like('birth_date','%-MM-DD')` (`dashboard.ts:176`, `sidebar`-подобные) — leading-wildcard, **не индексируется** → seq-scan clients на каждый дашборд. → хранить/индексировать выражение `to_char(birth_date,'MM-DD')` (expression index) или отдельную колонку `birth_mmdd`.
- **`clients.debt`** — `gt('debt',0)` (`dashboard.ts:173`) без частичного индекса → seq-scan. → `create index on clients(club_id) where debt > 0`.
- **Дубль-индекс:** `idx_clients_fullname_trgm` и `idx_clients_name_trgm` идентичны (оба `gin(full_name)`). Один дропнуть — лишняя нагрузка на запись/место.

### 🟠 #6. Тяжёлый клиентский JS (recharts/framer)
Крупнейшие клиентские чанки в `.next`: **402 KB + 381 KB×2 + 222 KB**. `recharts` импортируется статически в `RevenueChart.tsx`, `DashboardCharts.tsx`, `DashboardVisitRadial.tsx`, `ReportsClient.tsx`, `MiniChart.tsx`. При низком TTFB и контенте 2–2.7 с именно download+parse+execute+hydration клиентского бандла доминирует.
(Хорошо: экспорт-либы `exceljs`/`jspdf`/`xlsx` НЕ в клиентском бандле — `exceljs` в route-handlers, import/export-кнопки без статических импортов.)
**Рекомендация:** ленивая загрузка графиков — `next/dynamic(() => import(...), { ssr:false, loading: skeleton })` для recharts-компонентов (они ниже первого экрана). Это срежет First Load JS дашборда/отчётов.

### 🟠 #7. Мутации без оптимистичного UI → полный `router.refresh()`
Оптимистичный хелпер `runAction` (`src/lib/use-action.ts:18`) применён лишь в **1 из 91** компонентов `components/app` (`ClubSettings.tsx`). **16 компонентов** после мутации делают `router.refresh()` — полный ре-рендер серверного роута, т.е. заново весь waterfall из #1/#2 (~2 с). Пример: `ManualVisitModal.tsx:388` (отметка визита), `NewPaymentModal`, `AddClientButton`, `VisitsTable`, `RenewSubscriptionButton`, `InventoryClient`/`PosClient`.
**Рекомендация:** для горячих мутаций (отметить визит, создать оплату, добавить клиента) — оптимистичное обновление списка/тоста через `runAction`/`useOptimistic`, а `router.refresh()` только фоном/точечно (или полагаться на уже подключённый `RealtimeProvider`).

### 🟢 #8. Мелочи
- `src/lib/sidebar.ts:39,46` — `support_tickets` тянутся все (по club_id) и фильтруются в JS. Мелко сейчас, но лучше считать непрочитанные в SQL.
- `src/lib/staff.ts:95` и `:113` — `getStaffKPI` и `getStaffList` независимо сканируют `staff`; `getStaffList` (`:116`) тянет ВСЕ visits с `staff_id` и считает уникальных клиентов в JS. На больших базах — over-fetch; лучше агрегировать в SQL/одним запросом staff.
- `src/app/(app)/payments/page.tsx:49-51` — запрос `club_payment_credentials` идёт серийно ПОСЛЕ `Promise.all` (:42). Включить в тот же `Promise.all`.

---

## 3. Интеракции (клик→ответ)
Частично: открытие клиентских модалок мгновенно (client-only, без сети). Замер сабмита «Добавить клиента» и «Отметить визит» не снят надёжно — селекторы кнопок/полей не совпали в отведённый бюджет (не залипал, по инструкции). Поведенчески подтверждено по коду: **после мутаций идёт `router.refresh()`** (полный серверный ре-рендер ~2 с) вместо оптимистики — см. #7, это и есть главный «медленный» отклик на действия.

---

## 4. Итоги

**Топ-5 самых медленных мест (по замерам):**
1. `/dashboard` — 2764 мс до контента
2. `/staff` — 2494 мс
3. `/visits` — 2324 мс
4. `/warehouse` — 2208 мс
5. `/payments` — 2169 мс (·`/clients` 2167 рядом)

**Топ-5 рекомендаций по impact:**
1. **Разгрузить общий layout** (`(app)/layout.tsx`): убрать двойной резолв клуба (звать `getCurrentClub()` без аргумента везде + `getAuthUser` внутри), убрать дублирующий `clubs`-запрос, распараллелить остаток. Эффект — на КАЖДОЙ странице `/app` (−2…3 auth round-trip'а, ~−300–600 мс).
2. **Индексы БД:** `stock_movements(club_id, created_at)` (сейчас full-scan), expression-индекс дня рождения, частичный по `clients.debt>0`, дроп дубль-trgm.
3. **Ленивая загрузка recharts** (dynamic import, ssr:false) на дашборде/отчётах — срез First Load JS (сейчас core-чанки 402+381+381 KB).
4. **Дашборд/склад — устранить внутренние waterfall'ы:** RPC в `Promise.all` (`dashboard.ts:170`), один `getInventory` на страницу склада (`inventory.ts:75/87`).
5. **Оптимистичный UI для горячих мутаций** вместо `router.refresh()` — раскатить `runAction`/`useOptimistic` на отметку визита, создание оплаты, добавление клиента (сейчас каждый сабмит = полный ~2 с ре-рендер).

**Рисков для боевых данных не было:** все замеры под изолированным тестовым клубом, удалён вместе с юзером (0 остаточных строк, 0 orphan-пользователей). Реальные данные и код не тронуты.
