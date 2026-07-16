# FitCRM — Security Audit (read-only, по коду)

_Аудитор: security-auditor · Дата: 2026-07-16 · Режим: read-only (правки не вносились)_

Модель угроз: RLS изолирует данные **только по клубу** (`club_id in user_club_ids()`, политики `for all`). Гранулярные права (`club.permissions.*`) и роли RLS **не проверяет** → каждый мутирующий Server Action обязан проверять права сам. Server Actions и публичный анон-REST Supabase — открытые эндпоинты; скрытие кнопок в UI не защищает.

Итог: изоляция по тенанту (club_id) держится везде — **кросс-тенантных дыр не найдено**. Основная проблема — **непоследовательная проверка гранулярных прав внутри клуба** (эскалация привилегий низкоправного сотрудника) и **эскалация до owner через анон-REST** из-за разрешающих write-политик RLS на `staff`.

---

## 1. Инвентаризация мутирующих Server Actions

Легенда вердикта: OK — права/скоуп корректны · ДЫРА — нет проверки прав, эксплуатируемо · MASKED — проверки нет, но write заблокирован RLS (owner-only) · N/A — self/публичный.

| Экшен (file:line) | Мутирует | getCurrentClub / club_id | Проверка прав/роли | Вердикт |
|---|---|---|---|---|
| clients `createClientAction` :34 | clients+subscriptions | да / да | нет `clients.create` | **ДЫРА** (Med) |
| clients `importClientsAction` :130 | clients (bulk) | да / да | нет `clients.create` | **ДЫРА** (Med) |
| clients `deleteClientAction` :157 | clients + каскад subs/visits | да / да | нет `clients.delete` | **ДЫРА** (High) |
| clients `updateClientAction` :179 | clients (вкл. balance/debt) | да / да | нет `clients.edit` | **ДЫРА** (Med) |
| clients `toggleFreezeAction` :226 | subscriptions.status | да / **нет club_id в подзапросе** (RLS спасает) | нет `clients.freeze` | **ДЫРА** (Med) |
| clients `renewSubscriptionAction` :261 | subscriptions | да / да | нет `clients.extend`/`memberships.sell` | **ДЫРА** (Med) |
| clients/import `batchImportClientsAction` :79 | clients/subs/memberships/visits (bulk, вкл. balance/debt, создаёт memberships) | да / да | нет прав | **ДЫРА** (Med) |
| memberships `createMembershipAction` :83 | memberships | да / да | нет `memberships.create` | **ДЫРА** (Med) |
| memberships `updateMembershipAction` :98 | memberships (вкл. price) | да / да | нет `memberships.edit`/`change_price` | **ДЫРА** (Med) |
| memberships `duplicate/setActive/setArchived` | memberships | да / да | нет прав | **ДЫРА** (Low) |
| memberships `deleteMembershipAction` :206 | memberships | да / да | нет `memberships.delete` | **ДЫРА** (Med) |
| payments `createPaymentAction` :49 | payments+subscriptions | да / да | **нет `payments.create`** | **ДЫРА** (High) |
| payments `createOnlinePaymentAction` :106 | payments (pending) | да / да | нет `payments.create` | **ДЫРА** (Med) |
| payments `sendPaymentLinkTelegramAction` :165 | — (шлёт TG) | да / да (svc scoped) | нет прав | Low |
| payments `exportPaymentsCsvAction` :23 | read | да / да | `payments.view` | OK |
| reconcile `confirm/ignore/manualAttach` | payments/acquiring | да / да (svc scoped) | `payments.create` | OK |
| visits `markVisitAction` :15 | visits + subscriptions.visits_used | да / да | **нет `visits.checkin`** | **ДЫРА** (Med) |
| visits `manualVisitAction` :200 | visits | да / да | `visits.manual` | OK |
| schedule `createClass/cancel/reschedule/addClient/markAttendance` | classes/bookings/visits | да / да | **нет `schedule.*`** | **ДЫРА** (Low-Med) |
| warehouse `addProductAction` :7 | products+inventory+movements | да / да | нет `warehouse.supply` | **ДЫРА** (Med) |
| warehouse `addSupplyAction` :51 | inventory+movements | да / да | нет `warehouse.supply` | **ДЫРА** (Med) |
| warehouse `writeoffAction` :89 | inventory+movements | да / да | нет `warehouse.writeoff` | **ДЫРА** (Med) |
| warehouse/pos `sellProductsAction` :28 | payments+inventory | да / да (svc scoped) | `warehouse.sell` | OK |
| warehouse/pos `updateProductDetailsAction` :130 | products | да / да | `warehouse.view` | OK |
| staff `add/updateBasic/updateSalary/payStaff/updatePermissions/updateRole/updateStatus` | staff/users | да / да | owner/admin + `staff.*`, защита owner-назначения | OK |
| settings/roles `save/create/delete` | club_roles | да / да | `club.role==="owner"` | OK |
| settings/club `updateStaffRoleAction` :295 | staff.role (**service client**) | да / да | owner/admin, **НЕ блокирует назначение `owner`** | **ДЫРА** (High) |
| settings/club `inviteStaffAction`/`createInviteLinkAction` :195/270 | staff_invitations | да / да | owner/admin, **role не валидируется** (можно `owner`) | **ДЫРА** (Low-Med) |
| settings/club `removeStaffAction` :312 | staff (service) | да / да | owner/admin, защита owner/self | OK |
| settings/club `saveClubBasic/saveNotifications/saveFinance/saveBranch/saveIntegration` | clubs | да / да (RLS client) | нет проверки прав | **MASKED** (RLS `clubs_update` owner-only) — Info |
| settings/club `requestPlan/requestPaymentConnection` | platform_* (service) | да / да | `settings.subscription`/`.integrations` \|\| owner | OK |
| settings/club `changePassword` :170 | auth (self) | — | self | N/A |
| settings/club `createBranch` :340 | clubs (create_club RPC) | user | RPC лимит 10 | OK |
| integrations `connectTelegram/disconnect/saveTelegramSettings` | clubs.tg_token/settings | да / да (RLS client) | нет проверки | **MASKED** (RLS owner-only) — Info |
| integrations `broadcastTelegramAction` :106 | шлёт TG всем + broadcasts | да / да | **нет `telegram.manage`** | **ДЫРА** (Med) |
| integrations `scheduleBroadcast/testBroadcast` | broadcasts / шлёт TG | да / да | нет `telegram.manage` | **ДЫРА** (Low-Med) |
| ai `askAiAction` :282 (tool `create_product`) | products (service) | да / да | **нет `ai.use` / `warehouse.*`** | **ДЫРА** (Low) |
| support `createTicket/upload/sendMessage/rate` | support_* (service) | да / да (scoped + path-check) | членство клуба | OK |
| profile `update*/uploadAvatar/updatePassword/updateEmail` | users/auth (self) | user | self, re-auth на пароль/email | OK |
| onboarding `saveClubInfo/saveWorkingHours/createFirstMembership` | clubs/memberships | user / первый клуб | нет role-проверки (поток онбординга) | Low |
| accept-invite `acceptInviteAction` :8 | staff (service) | user + токен | валидация токена/email/срока | OK |
| auth `signIn/signUp/reset/…` | auth | — | пароль≥8, open-redirect guard | OK |
| platform `impersonate/extendTrial/changePlan/setClubStatus/plans*/subscriptions*/connections*/support*` | всё (service, bypass RLS) | — | **`getPlatformAuth()`** во всех | OK |

Проверено **более 70** мутирующих экшенов. С дырами (эксплуатируемо низкоправным сотрудником) — **~25 экшенов** в 6 разделах (clients, memberships, payments, visits, schedule, warehouse, integrations) + 2 точечных в staff-управлении.

---

## 2. Находки по severity

### HIGH-1 — Эскалация до `owner` через анон-REST (разрешающие write-политики RLS на `staff`)
**Где:** `supabase/migrations/0011_fixes.sql:22-30` (политики `staff_update`/`staff_insert`), решение зафиксировано в `supabase/migrations/0051_security_hardening.sql` (комментарий: RLS намеренно не ужесточают).
**Подтверждено кодом.**
Политики:
```
create policy staff_update on public.staff for update
  using  (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));   -- роль НЕ проверяется
```
`NEXT_PUBLIC_SUPABASE_ANON_KEY` публичен (`src/lib/supabase/client.ts`), а JWT сессии лежит в куках. `getCurrentClub()` даёт полные права, если `staff.role==='owner'` (`src/lib/club.ts:94`).
**PoC:** любой активный сотрудник клуба (напр. `trainer`) достаёт свой access-token из кук и делает прямой запрос к PostgREST:
```
PATCH https://<project>.supabase.co/rest/v1/staff?id=eq.<свой_staff_id>
apikey: <anon>   Authorization: Bearer <свой_jwt>
{ "role": "owner" }
```
WITH CHECK проходит (club_id тот же) → пользователь становится owner своего клуба, минуя все проверки в server actions. Далее — полный контроль клуба (удаление сотрудников, зарплаты, оплаты и т.д.). Ограничено своим клубом (кросс-тенанта нет).
**Фикс:** ужесточить `with check` для `staff_update`, запретив смену `role`/`salary` неадминам, например через триггер `BEFORE UPDATE`, который блокирует изменение `role`/`salary`/`settings.permissions`, если `current_setting` пользователь не owner/admin данного клуба (и запрет назначения `owner` кем-либо кроме owner). Разрешающую логику для кастомных ролей с правом на персонал реализовать в триггере, а не оставлять RLS полностью открытым. То же для `staff_insert` (кто и с какой ролью может добавляться).

### HIGH-2 — `updateStaffRoleAction` в настройках клуба назначает роль `owner` (admin → owner)
**Где:** `src/app/(app)/settings/club/actions.ts:295-310`. **Подтверждено кодом.**
Проверяет `["owner","admin"].includes(club.role)` и блокирует смену роли существующего owner, но **не блокирует установку `role="owner"` на не-owner** (в отличие от корректного `staff/actions.ts:206` `updateStaffRoleAction`, где есть `if (roleKey === "owner" && club.role !== "owner") return …`). Использует **service client** (bypass RLS).
**PoC:** пользователь с ролью `admin` вызывает server action `updateStaffRoleAction(<свой_или_чужой_staffId>, "owner")` → назначает owner (в т.ч. себе). Эскалация admin→owner.
**Фикс:** добавить `if (role === "owner" && club.role !== "owner") return { error: "Только владелец может назначить владельца" }` и валидацию `role` по списку известных ролей клуба.

### HIGH-3 — Удаление клиентов без права `clients.delete`
**Где:** `src/app/(app)/clients/actions.ts:157`. **Подтверждено кодом.**
`deleteClientAction` не проверяет `club.permissions.clients.delete`. RLS (`clients_club_all`, `for all`) разрешает delete любому члену клуба. Удаление каскадит `subscriptions`/`visits` (`ON DELETE CASCADE`).
**PoC:** `trainer`/`cashier` (`clients.delete=false`) вызывает `deleteClientAction(id)` напрямую → клиент и вся его история удалены.
**Фикс:** `if (!(["owner","admin"].includes(club.role) || club.permissions.clients.delete)) return { error: "Недостаточно прав" }`.

### HIGH-4 — Создание платежей/подписок без права `payments.create`
**Где:** `src/app/(app)/payments/actions.ts:49` (`createPaymentAction`), `:106` (`createOnlinePaymentAction`). **Подтверждено кодом.**
Нет проверки `payments.create`. Экшен создаёт запись `payments(status:paid)` и активную `subscription`. Фальсификация финансовых записей / бесплатная выдача абонементов низкоправным сотрудником.
**PoC:** `trainer` (`payments.create=false`) вызывает `createPaymentAction({clientId, membershipId, amount:0, provider:"cash"})` → создаётся оплаченный платёж и активный абонемент.
**Фикс:** проверка `payments.create` (owner/admin || permission) в начале обоих экшенов.

### MEDIUM-1 — Системный пропуск гранулярных проверок в мутирующих экшенах (clients/memberships/visits/schedule/warehouse)
**Где (подтверждено кодом):**
- clients: `createClientAction:34`, `importClientsAction:130`, `updateClientAction:179` (вкл. `balance`/`debt`), `toggleFreezeAction:226`, `renewSubscriptionAction:261`, `import-actions.ts batchImportClientsAction:79`
- memberships: `create:83`, `update:98` (цена), `delete:206`, `duplicate/setActive/setArchived`
- visits: `markVisitAction:15` (нет `visits.checkin`)
- schedule: `createClassAction:10`, `cancelClassAction:46`, `rescheduleClassAction:60`, `addClientToClassAction:75`, `markAttendanceAction:110`
- warehouse: `addProductAction:7`, `addSupplyAction:51`, `writeoffAction:89` (нет `warehouse.supply/writeoff`)

Единый класс: экшен делает `getCurrentClub()` и пишет через RLS-клиент (таблицы `for all` по club_id), но **не сверяет `club.permissions.*`**. Любой активный сотрудник клуба, вызвав экшен как HTTP-эндпоинт (независимо от UI), выполняет действие, на которое у него нет прав (создать/менять абонементы и цены, менять баланс/долг клиента, править склад, отмечать посещения). Внутри тенанта; кросс-тенанта нет.
**Фикс:** в начале каждого мутирующего экшена — стандартный гейт `if (!(["owner","admin"].includes(club.role) || club.permissions.<module>.<action>)) return { error: "Недостаточно прав" }`. Значения по умолчанию помнить: `admin` имеет `clients.delete=false`, `memberships.change_price=false` и т.п. — проверять конкретное право, а не только роль.

### MEDIUM-2 — Массовая Telegram-рассылка без права `telegram.manage`
**Где:** `src/app/(app)/integrations/actions.ts:106` (`broadcastTelegramAction`), `:140` (`scheduleBroadcast`), `:173` (`testBroadcast`). **Подтверждено кодом.**
Нет проверки `telegram.manage`. Отправка сообщений всем клиентам клуба происходит до/независимо от записи в БД (сам `sendBroadcast` выполняется), поэтому даже если RLS-insert в `broadcasts` отфильтруется, сообщения уже ушли. Низкоправный сотрудник может рассылать спам всей базе клиентов от имени бота клуба.
**Фикс:** гейт `telegram.manage` (owner/admin || permission) в начале broadcast-экшенов (и в `getBroadcastCtx`).

### LOW-1 — Роль в приглашениях не валидируется (admin может пригласить `owner`)
**Где:** `src/app/(app)/settings/club/actions.ts:195` (`inviteStaffAction`), `:270` (`createInviteLinkAction`). **Подтверждено кодом.**
Проверяется `["owner","admin"]`, но `data.role` подставляется в `staff_invitations` без валидации — admin может создать инвайт с `role="owner"` или произвольным ключом роли. При приёме (`accept-invite`) роль применяется как есть.
**Фикс:** валидировать `role` по списку клубных ролей и запретить `owner` при `club.role!=="owner"`.

### LOW-2 — AI-экшен без проверки `ai.use` и прав на запись
**Где:** `src/app/(app)/ai/actions.ts:282` (`askAiAction`), tool `create_product` (:94, exec ~:220). **Подтверждено кодом.**
Нет проверки `ai.use`; tool `create_product` создаёт товар без `warehouse.supply`. Сотрудник без права на AI/склад может пользоваться ассистентом (доступ к агрегатам клуба) и создавать товары.
**Фикс:** проверка `ai.use` в начале `askAiAction`; для tool-ов, делающих запись, — проверка соответствующего права.

### LOW-3 — PostgREST-фильтр из необёрнутого ввода (platform, admin-only)
**Где:** `src/app/platform/(protected)/plans/actions.ts:115` — `.or(\`code.eq.${p.code},slug.eq.${p.slug}\`)`. **Подтверждено кодом.**
`code`/`slug` интерполируются в грамматику `.or()` без `sanitizeSearchTerm`. Эндпоинт только для platform-админа (высокое доверие), запрос — read (дубль-чек). Риск низкий (сломать/подмешать условие фильтра).
**Фикс:** параметризовать через отдельные `.eq()` или экранировать.

### INFO
- **settings/club и integrations мутации `clubs`** (`saveClubBasic/Notifications/Finance/Branch/Integration`, `connectTelegram/disconnect/saveTelegramSettings`) не проверяют права, но защищены RLS `clubs_update` (owner-only, `0001_init.sql:343`) — не эксплуатируется не-owner’ом (для admin это скорее функциональный баг: настройки не сохранятся). Рекомендуется всё же добавить явные проверки `settings.general/integrations` для консистентности и корректных сообщений.
- **`api/broadcasts/run`** (`route.ts:11`) принимает `?secret=CRON_SECRET` в query — может утечь в логи/Referer. Лучше только заголовок `Authorization: Bearer`.
- **auth/callback** (`route.ts:31`) для `next` не проверяет обратный слэш (`\`), в отличие от `(auth)/actions.ts`. Не эксплуатируется (значение префиксуется `origin`, остаётся на своём домене), но лучше выровнять проверки.
- **`toggleFreezeAction`** обновляет `subscriptions` по `id` без явного `.eq("club_id", …)` — сейчас спасает RLS; при рефакторинге на service-client станет дырой. Добавить явный club-скоуп.

---

## 3. Что проверено и признано корректным (положительное)
- **Тенант-изоляция (club_id)** выдержана во всех экшенах и `for all` RLS-политиках; кросс-тенантных утечек не найдено.
- **`clubs`** — write только owner (`clubs_update: owner_id = auth.uid()`); `users` — только своя строка.
- **Платёжные вебхуки**: Payme — Basic-auth `Paycom:KEY` + сверка суммы/статуса (`api/pay/payme/[clubId]/route.ts:29`); Click — MD5 sign-check + сверка суммы (`api/pay/click/[clubId]/route.ts:53`); оба скоупятся по `clubId`.
- **Cron** (`api/cron/reconcile`, `api/telegram/daily-report`, `api/broadcasts/run`) — `CRON_SECRET` Bearer, fail-closed при отсутствии секрета.
- **Telegram webhook** — опциональная проверка `X-Telegram-Bot-Api-Secret-Token`.
- **Platform Admin** — все экшены за `getPlatformAuth()` (platform_role); service-role используется только после проверки.
- **Service-role в `(app)`** (payments/warehouse/support/reconcile/staff-invite) — везде ручной скоуп по `club.clubId`; в support дополнительно валидируется префикс пути вложения `${clubId}/`.
- **Impersonation** — `pa_impersonate` действует только для platform-админа (`club.ts:32-53`); `switchBranchAction` явно гасит impersonation и проверяет членство.
- **Поиск**: все `.or(...ilike...)` обёрнуты в `sanitizeSearchTerm()` (`search.ts`); `.ilike(col, …)` — параметризованный вызов, инъекции грамматики нет.
- **Auth**: пароль ≥ 8; open-redirect в `signIn/signInWithGoogle/signOut/verifyPhoneOTP` закрыт (`startsWith("/") && !"//" && !"\\"`); re-auth перед сменой пароля/email в профиле.
- Хардкод секретов не найден; `dangerouslySetInnerHTML` с пользовательским вводом не найден.

---

## 4. Сводка и вердикт
- Проверено мутирующих Server Actions: **> 70**. Полностью корректны (права+скоуп): staff, roles, reconcile, pos, reports, support, profile, platform, auth, webhooks.
- Экшенов с эксплуатируемыми дырами (эскалация привилегий внутри клуба): **~25** в разделах clients / memberships / payments / visits / schedule / warehouse / integrations, плюс 2 точечных в staff-управлении.
- **Кросс-тенантных дыр нет** — изоляция по `club_id` держится (RLS + ручной скоуп service-client).
- **Главный риск — внутриклубная эскалация привилегий:** (1) любой сотрудник → `owner` через прямой анон-REST на `staff` (разрешающие RLS-политики, HIGH-1); (2) admin → `owner` через `settings/club updateStaffRoleAction` (HIGH-2); (3) низкоправные сотрудники выполняют действия без нужных гранулярных прав из-за системного пропуска проверок в экшенах (HIGH-3/4, MEDIUM-1/2).

**Вердикт:** мультитенантность (главный инвариант) — надёжна. Но инвариант «каждый мутирующий экшен проверяет права» соблюдён лишь частично: дисциплина проверок есть в недавно ужесточённых разделах (staff, reports, pos, reconcile), но отсутствует в clients/memberships/payments/visits/schedule/warehouse/integrations. Плюс RLS на `staff` оставлен полностью открытым на запись, что даёт прямую эскалацию до owner в обход server actions. Рекомендация: (а) закрыть write-RLS на `staff` триггером; (б) прогнать все мутирующие экшены через единый permission-гейт (helper `requirePermission(club, module, action)`).
