# QA_VERIFY — верификация security-аудита (гранулярные права + DB-триггер эскалации)

Дата: 2026-07-16 · Прод: https://fitcrm-three.vercel.app · Ветка/код: /Users/amiran/fitcrm

**Вердикт: PASS с 1 замечанием (Medium).** Все ключевые фиксы на месте, сборка/типы чистые, DB-триггер эскалации и изоляция клубов подтверждены вживую. Найден 1 незакрытый app-level разрыв: `toggleFreezeAction` без проверки прав (см. Finding-1).

Счёт: **PASS 4 / 4 блока** (Статика с оговоркой · Сборка · Smoke · Live). Проверок прав подтверждено **28/29 по спецификации + 1 эквивалент**; **1 пропуск** (toggleFreeze).

---

## 1. Статическая проверка фиксов (по коду)

`if (!can(` в `src/app/(app)` — **29** (ожидалось ~29). ✅

| Action | Ожидаемая проверка | file:line | Статус |
|---|---|---|---|
| clients: createClientAction | clients.create | clients/actions.ts:56 | ЕСТЬ |
| clients: updateClientAction | clients.edit | clients/actions.ts:202 | ЕСТЬ |
| clients: deleteClientAction | clients.delete | clients/actions.ts:165 | ЕСТЬ* (role-OR-perm: `["owner","admin"].includes(role) \|\| perms.clients.delete`) |
| clients: toggleFreezeAction | clients.freeze | clients/actions.ts:232–259 | **НЕТ** ⚠️ (Finding-1) |
| clients: renewSubscriptionAction | clients.extend | clients/actions.ts:272 | ЕСТЬ (+ лишний `freeze` на :273) |
| clients: importClientsAction | clients.create | clients/actions.ts:140 | ЕСТЬ |
| import-actions: batchImportClientsAction | clients.create | clients/import-actions.ts:89 | ЕСТЬ |
| memberships: create | memberships.create | memberships/actions.ts:90 | ЕСТЬ |
| memberships: update | memberships.edit | memberships/actions.ts:128 | ЕСТЬ |
| memberships: duplicate | memberships.create | memberships/actions.ts:157 | ЕСТЬ |
| memberships: setActive | memberships.edit | memberships/actions.ts:185 | ЕСТЬ |
| memberships: setArchived | memberships.edit | memberships/actions.ts:200 | ЕСТЬ |
| memberships: delete | memberships.delete | memberships/actions.ts:215 | ЕСТЬ |
| visits: markVisitAction | visits.checkin | visits/actions.ts:23 | ЕСТЬ |
| visits: manualVisitAction | visits.manual | visits/actions.ts:209 | ЕСТЬ |
| schedule: createClass | schedule.create | schedule/actions.ts:26 | ЕСТЬ |
| schedule: cancel | schedule.edit | schedule/actions.ts:51 | ЕСТЬ |
| schedule: reschedule | schedule.edit | schedule/actions.ts:67 | ЕСТЬ |
| schedule: addClient | schedule.edit | schedule/actions.ts:83 | ЕСТЬ |
| schedule: markAttendance | schedule.edit | schedule/actions.ts:118 | ЕСТЬ |
| warehouse: addProduct | warehouse.supply | warehouse/actions.ts:12 | ЕСТЬ |
| warehouse: addSupply | warehouse.supply | warehouse/actions.ts:57 | ЕСТЬ |
| warehouse: writeoff | warehouse.writeoff | warehouse/actions.ts:96 | ЕСТЬ |
| ai: getBriefing | ai.use | ai/actions.ts:46 | ЕСТЬ |
| ai: askAi | ai.use | ai/actions.ts:287 | ЕСТЬ |
| integrations: connect | telegram.manage | integrations/actions.ts:34 | ЕСТЬ |
| integrations: disconnect | telegram.manage | integrations/actions.ts:61 | ЕСТЬ |
| integrations: getBroadcastCtx (→broadcast/schedule/test) | telegram.manage | integrations/actions.ts:86 | ЕСТЬ (хелпер :79; вызывается из broadcast :120, schedule :158, test :185) |
| integrations: saveSettings | telegram.manage | integrations/actions.ts:217 | ЕСТЬ |
| settings/club: inviteStaffAction | блок owner не-владельцем | settings/club/actions.ts:199 | ЕСТЬ (+ роль-гейт :198) |
| settings/club: createInviteLinkAction | блок owner не-владельцем | settings/club/actions.ts:275 | ЕСТЬ (+ роль-гейт :274) |
| settings/club: updateStaffRoleAction | блок owner не-владельцем | settings/club/actions.ts:302 | ЕСТЬ (+ иммутабельность owner :308) |
| platform/plans: .or() code/slug | sanitizeSearchTerm | platform/(protected)/plans/actions.ts:116 | ЕСТЬ |

\* `deleteClientAction` использует эквивалентный паттерн (роль-ИЛИ-право), не `can()`. Функционально корректно, поэтому в счётчик `if (!can(`=29 не входит.

### Логика helper `can()` (src/lib/permissions.ts:130–133)
```ts
export function can(permissions, module, action): boolean {
  const mod = permissions[module] as Record<string, boolean>
  return mod?.[action] === true
}
```
- `owner` = `ALL_TRUE_PERMS` (permissions.ts:26–39, назначается на owner в DEFAULT_ROLE_PERMISSIONS:57) → любой `can(...)` возвращает `true`. `can(ALL_TRUE,"memberships","delete") === true`. **Owner нигде не блокируется.** ✅
- Роли на базе `ALL_FALSE_PERMS` → `can(ALL_FALSE,"clients","create") === false` (`false === true` → false). ✅
- Косвенно подтверждено live: оба owner-юзера успешно прошли `create_club` (ниже).

---

## 2. Сборка / типы
- `npx tsc --noEmit`: **EXIT 0**, 0 ошибок (после отсева `.next/types/validator.ts`). ✅
- `npm run build`: **EXIT 0**, билд прошёл (все роуты собраны, middleware ok). ✅

---

## 3. Live smoke (GET) против https://fitcrm-three.vercel.app
| Проверка | Результат |
|---|---|
| Публичные `/ /about /contacts /docs /terms /privacy /login /register` | 200 ✅ |
| `/robots.txt`, `/sitemap.xml` | 200 ✅ |
| Приватные `/dashboard /clients /settings /platform` | 307 → `/login` ✅ |
| Утечки `/.env.local /.env /.git/config` | 307 → `/login` (не отдаются) ✅ |
| Security-заголовки (`/`) | HSTS `max-age=63072000; includeSubDomains; preload`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `referrer-policy: strict-origin-when-cross-origin` ✅. CSP не задан (не регресс аудита). |

---

## 4. Live: создание клубов + изоляция + DB-триггер (0052)
Временный `node --env-file=.env.local` + `@supabase/supabase-js`. 2 подтверждённых юзера (`admin.createUser email_confirm` → `signInWithPassword` → `rpc create_club`). Юзер B дополнительно добавлен service-клиентом как `reception` в клуб №1 для теста эскалации.

| Проверка | Результат |
|---|---|
| create_club юзером A/B (RPC под JWT) | оба клуба созданы, `clubs.owner_id` = создатель ✅ (новый код/триггер не сломали создание) |
| owner-staff bootstrap | по 1 строке `staff` role=`owner` в каждом клубе ✅ (триггер пропускает bootstrap через `clubs.owner_id`) |
| Изоляция: юзер A → строки клуба №2 | `clubs`=0, `staff`=0 ✅ |
| Триггер: reception → `update staff set role='owner'` (свой) в клубе №1 | **ЗАБЛОКИРОВАНО** — `only owner can assign owner role`; роль осталась `reception` ✅ |
| Триггер: reception → смена своих `settings.permissions` | **ЗАБЛОКИРОВАНО** — `cannot change own permissions`; права не изменились ✅ |

### Уборка
`cleanup_done={staff:0,clubs:2,users:2}`, `remaining_clubs=0`, `remaining_staff=0`, оба auth-юзера удалены. **CLEANUP_PASS=true.** Временный скрипт удалён (`_qa_livetest.mjs` не оставлен в проекте). Реальные данные/код не тронуты, секреты не логировались. ✅

---

## Findings

### Finding-1 (Medium) — `toggleFreezeAction` без проверки прав
`src/app/(app)/clients/actions.ts:232–259` — функция замораживает/размораживает абонемент, но **не вызывает `getCurrentClub()` и не проверяет `can(..., "clients", "freeze")`**. Идёт сразу в `createClient()` (RLS) → `subscriptions.update`. RLS скоупит по клубу, но НЕ по праву `clients.freeze` — значит любой авторизованный член клуба (в т.ч. без права freeze) может морозить/размораживать абонементы через прямой вызов Server Action.

Похоже, проверка `freeze` уехала не в ту функцию: в `renewSubscriptionAction` (:267) стоят **обе** — `extend` (:272) и `freeze` (:273), причём `freeze` там избыточен. Вероятный фикс: перенести `if (!can(club.permissions, "clients", "freeze")) ...` в `toggleFreezeAction` (добавив `getCurrentClub()` guard), убрав дубль на :273.

Severity Medium: это app-level bypass гранулярного права, но операция не деструктивна (обратима, не утечка данных, изоляция по клубу сохраняется через RLS).

---

## Что НЕ проверяемо без браузера (рантайм app-level)
App-level проверки `can()` живут в Server Actions — это не REST, из node-скрипта не вызвать. Верифицировано по коду (наличие проверки), но НЕ прогнано в рантайме:
- Что owner/admin реально проходят действия, а низкая роль (trainer/cashier/reception) получает `{ error: "Недостаточно прав" }` при кликах в UI.
- Реальный ответ Server Actions на попытку действия без права (текст ошибки, отсутствие мутации).
- UI-гейтинг кнопок по правам (косметика, не безопасность).

Как проверить: залогиниться под аккаунтами с ролями owner / admin / trainer и вручную прогнать по одному действию из каждого модуля (create/edit/delete клиента, продажа/удаление абонемента, checkin/manual визит, расписание, склад, AI, Telegram). Особенно — freeze/unfreeze под ролью без права `clients.freeze` (см. Finding-1).
