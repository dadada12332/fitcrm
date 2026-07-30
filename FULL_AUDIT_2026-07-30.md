# Zalkins — полный аудит CRM и Platform Admin

_Дата: 30 июля 2026 · режим: code review, production-safe проверки, локальные тесты и read-only аудит production-инфраструктуры._

## Краткий вывод

Zalkins уже покрывает основной операционный цикл фитнес-клуба: регистрацию и onboarding,
клиентов, абонементы, посещения, расписание, платежи, склад, сотрудников, удержание, отчёты,
Telegram Mini App, интеграции и Platform Admin. Сборка проходит, основной набор тестов зелёный,
а базовая RLS-изоляция двух временных QA-клубов подтвердилась.

При этом текущую версию нельзя считать готовой к безопасному масштабированию до устранения
двух критических классов проблем:

1. любой авторизованный пользователь может изменить свой `platform_role` через Supabase REST
   и получить доступ Platform Admin и all-club scope;
2. владелец клуба может напрямую изменить platform-only поля своего клуба, включая тариф,
   статус и сроки подписки, минуя биллинг.

Платёжные callback также требуют приоритетной переработки: сейчас провайдер может получить
успешный ответ, даже если CRM не сохранила платёж или не выдала абонемент, а конкурентные
callback способны повторно списать склад.

> Статус после исправлений: пункты согласованного списка 1–6 и 8–10 закрыты
> миграцией и кодом от 30 июля 2026 года. Пункт 7 (полная локализация CRM) по
> решению владельца не изменялся. Подробности и оставшиеся внешние ограничения
> приведены в разделе «Ремедиация».

## Что проверено

- Код CRM, Platform Admin, Telegram, Click, Payme, Google Calendar, Instagram и access control.
- Схема production Supabase, RLS, grants, `SECURITY DEFINER`, Storage и Security/Performance
  Advisor.
- Auth gates, публичные маршруты, security headers и две временные tenant-сессии.
- Owner/reception/staff сценарии по основным разделам.
- Unit/integration, Bridge, E2E, TypeScript/build/lint и dependency audit.
- Полнота продукта относительно Glofox, Mindbody, GymMaster, PushPress, Virtuagym,
  PerfectGym и YCLIENTS.

Не проводились: реальный restore из backup, реальная оплата у Click/Payme, нагрузка на
production, App Review Instagram, Google OAuth verification, физические турникеты и
commissioning Sigur/ZKTeco/Hikvision.

## Результаты автоматических и безопасных динамических проверок

| Проверка | Результат |
|---|---|
| `npm run test` | 164 passed, 1 skipped |
| Bridge tests | 41 passed |
| `npm run build` | успешно, 64 static pages |
| ESLint | не проходит: 1 error и 9 warnings |
| Playwright E2E | 34 passed, 6 skipped, 4 failed |
| Production smoke | public routes и health `200`, private routes корректно редиректят |
| RLS two-tenant negative test | A не читает B, B не читает A, cross-tenant insert отклонён |
| Production tables | 71/71 public tables с RLS |
| Dependency audit | 12 известных уязвимостей: 6 high, 4 moderate, 2 low |

Четыре E2E-падения имеют один источник: глобальный cookie banner перекрывает нижнюю навигацию
Telegram Mini App на desktop и mobile.

## P0 — исправить до следующего масштабирования

### 1. Самоэскалация в Platform Admin

`authenticated` может обновлять `public.users.platform_role` в собственной строке. После
установки любого non-null значения `user_club_ids()` возвращает все клубы, а Platform Admin
доверяет этому полю и использует service role.

Затронуто:

- `supabase/migrations/0023_platform_admin.sql`
- `supabase/migrations/0054_performance_roundtrip_repair.sql`
- `supabase/migrations/0024_platform_admin_rls.sql`
- `src/lib/platform.ts`
- `src/app/platform/login/actions.ts`

Что сделать:

1. отозвать у `authenticated` право INSERT/UPDATE на `platform_role`;
2. ограничить self-update безопасным списком полей либо DB-trigger;
3. менять platform role только service-only RPC;
4. проверять точные допустимые роли в `user_club_ids()`;
5. проверить и отозвать все активные platform-сессии после миграции;
6. добавить regression test прямого PostgREST PATCH.

### 2. Самоназначение тарифа владельцем клуба

Политика `clubs_update` контролирует `owner_id`, но не запрещает владельцу менять `plan`,
`plan_id`, `trial_expires_at`, `plan_expires_at`, `status`, locked price и другие
platform-only поля.

Что сделать:

- разделить business-editable и platform-only колонки;
- запретить их изменение authenticated-пользователям DB-trigger или column grants;
- оставить изменение подписки только атомарным service-only billing RPC;
- добавить прямые REST negative tests для owner.

### 3. Недостоверное подтверждение платежей

Click/Payme callback не проверяют ошибки Supabase, `afterPaymentPaid()` глотает исключения, а
складские операции неатомарны. Провайдер может перестать ретраить платёж, который внутри CRM
остался `pending`, либо повторный callback дважды изменит склад.

Что сделать:

- единый атомарный RPC `confirm_provider_payment`;
- row lock/idempotency на provider transaction ID;
- транзакционно создавать абонемент, движения склада и audit event;
- отвечать провайдеру успехом только после commit;
- безопасный retry и reconciliation;
- contract tests на duplicate/out-of-order callback и DB failure.

## P1 — высокий приоритет

### Безопасность и данные

1. Обновить Next.js минимум с `16.2.7` до исправленной версии `16.2.12+` и закрыть остальные
   high-зависимости после regression build.
2. Включить leaked-password protection в Supabase Auth.
3. Настроить ежедневный off-site DB dump, отдельный backup Storage и квартальный restore
   drill. Сейчас PITR выключен и доступных production backup нет.
4. Добавить composite tenant FK или общий trigger для `retention_cases`,
   `client_interactions`, `notifications` и остальных ссылок на tenant entities.
5. Добавить CSP и Permissions-Policy; проверить report-only перед enforcement.
6. Защитить `/api/auth/sms-hook` подписью/секретом, rate limit и безопасными ошибками.
7. Запретить fallback encryption key на service-role secret; внедрить versioned key rotation.
8. Шифровать Telegram bot tokens отдельным ключом/KMS, а не хранить plaintext.
9. Перенести production с free backup posture на план с PITR либо задокументированный
   независимый backup pipeline.

### RBAC

1. Реально применять индивидуальные staff permissions: сейчас они сохраняются в settings, но
   `resolvePermissions` и Telegram actor их игнорируют.
2. Разделить `payments.view` и `view_revenue`: cashier/manager могут видеть суммы и KPI при
   запрещённом revenue.
3. Добавить permission check в `refreshReconAction()`.
4. Учитывать `memberships.change_price` при редактировании тарифа.
5. Ограничить trainer его клиентами/занятиями и скрыть class income.
6. Capability-filter для Quick Actions, schedule drawer и staff UI, а не только скрытие
   отдельных страниц.
7. Реализовать или убрать декларативные, но неработающие права `refunds`, `checkout`,
   `delete_history`.

### Platform Admin

1. Перепроектировать impersonation: сейчас UI выдаёт service identity, но RLS-сессия не имеет
   membership и часть CRM будет пустой или ошибочной.
2. Синхронизировать custom paid plan с legacy `clubs.plan`, иначе оплаченный клуб может
   остаться `trial` и быть заблокирован gate.
3. При раннем продлении считать новый срок от `max(now, current_expiry)`, а не сжигать остаток.
4. Сделать сохранение тарифов валидируемым и транзакционным: запрет отрицательных цен/лимитов,
   проверка валюты и периода.
5. Исправить mixed-currency аналитику: `fmtSum()` не должен подписывать USD как UZS.
6. Закрыть Google OAuth bypass выключенной регистрации и обязательного legal acceptance.
7. Logout должен очищать impersonation cookies.
8. Реальное редактирование активных Payme/Click подключений либо честный read-only UI.
9. Привязать и проверить отдельные домены Admin/CRM; сейчас `admin.fitcrm.uz` и
   `app.fitcrm.uz` не резолвятся.

### Интеграции и фоновые задачи

1. Реализовать provider-certified reconciliation: Click/Payme fetcher сейчас возвращает
   пустой массив и создаёт ложный зелёный статус.
2. Полный refund lifecycle: отозвать абонемент/услугу, восстановить склад, записать audit.
3. Telegram webhook не должен всегда отвечать `200` при внутреннем исключении.
4. Исправить idempotency reminder: failed-сообщение сейчас уже никогда не ретраится.
5. Добавить lease, retry/backoff, recipient ledger и recovery для broadcasts.
6. Instagram: исправить revenue status `completed`, реализовать event processing, pagination,
   checkpoints, scheduled retry и честный data-deletion status.
7. Cron monitoring должен проверять freshness и outcome каждой job, а не только последний
   общий успешный запуск.
8. Access-control оставить `Beta` до hardware commissioning; текущий test проверяет конфиг,
   но не реальный контроллер.
9. Исправить middleware для `/api/access-control`: production-safe запросы к `events` и
   `decision` сейчас получают `307 /login`, поэтому headless Bridge/турникет без browser cookie
   не может передавать события. Routes уже имеют API-key auth и должны быть публичными только
   на уровне route gate, сохраняя собственную проверку ключа.

### Продуктовые баги

1. Cookie banner не должен блокировать навигацию Mini App.
2. Staff profile revenue/renewals сейчас всегда `0`.
3. Staff KPI подписан как total, но считает только active.
4. Telegram integration catalog показывает всех CRM-клиентов как Telegram-клиентов.
5. Первый onboarding-тариф должен включать настраиваемый freeze allowance.
6. Payments page нужен loading/skeleton вместо пустого экрана до stream data.

### UX, accessibility и локализация

1. Mobile drawers CRM и Platform не переводят и не удерживают keyboard focus, Escape не
   закрывает меню. Нужны dialog semantics, focus trap/return и Escape-close в `AppShell.tsx`
   и `PlatformShell.tsx`.
2. `--gray-muted` даёт около `2.6:1` на белом фоне вместо `4.5:1`; токен используется
   276 раз в 59 TSX-файлах, включая небольшие KPI-подписи.
3. RU/UZ/EN словари формально полные, но это ещё не полная локализация:
   133 жёстких `ru-RU` formatter в 57 файлах, SSR всегда отдаёт `<html lang="ru">`, а
   Platform Admin исключён из генератора переводов.
4. Исправить смысловые машинные переводы (`ср. чек` сейчас превращается в `Wed check` /
   `Chorshanba`) и провести human linguistic QA.
5. Mobile export button остаётся без accessible name после скрытия текста.

## P2 — следующий цикл

### Надёжность и поддерживаемость

- Привести migration ledger в соответствие схеме: локальные migrations применяются raw SQL и
  почти не отражаются в `supabase_migrations`.
- Добавить retention policy/TTL для audit logs, Telegram events, OAuth states, invite records,
  platform logs и PII.
- Спроектировать privacy erasure: сейчас delete client не удаляет финансовые ссылки и PII
  может остаться в audit JSON.
- Сделать `broadcasts` и `product-photos` private или использовать signed URLs.
- Перенести `pg_trgm` из `public`.
- Разобрать 13 unindexed FK, duplicate client index и 48 unused indexes после нормального
  периода observability.
- Исправить один lint error в `src/lib/client-profile.ts` и warnings.
- Устранить N+1/large-list риски и обеспечить pagination во всех операционных таблицах.
- Добавить error boundaries, retry и network-offline состояния для Mini App и CRM.
- Стандартизировать cashier/receptionist терминологию.
- Довести Global Search до настоящего accessible dialog, notification filters — до tabs.
- Увеличить sidebar/topbar touch targets до 44×44 px там, где это возможно.
- Добавить `role="status"` и текст для screen reader в route loading states; убрать
  фиксированную 510 px колонку из mobile dashboard skeleton.

## Ремедиация 30 июля 2026

Исправлено:

1. `platform_role` защищён DB-trigger, wildcard Platform Admin ограничен точными
   ролями, self-delete профиля закрыт.
2. Platform-only поля клуба защищены DB-trigger от прямого изменения через
   authenticated Data API.
3. Click и Payme подтверждают платёж, склад и абонемент единым
   `confirm_provider_payment`; добавлены row lock и идемпотентность. Payme
   create/perform/cancel также переведены в транзакционные RPC.
4. Индивидуальные права сотрудника реально применяются в CRM и Telegram Mini
   App; выдача неизвестных или более широких прав отклоняется.
5. `/api/access-control` пропускается middleware до собственного API-key gate.
   Анонимный запрос теперь получает `401` API, а не browser redirect на login.
6. Cookie notice исключён из Telegram Mini App; mobile drawers получили dialog
   semantics, Escape, focus trap/return и блокировку фонового scroll.
7. Полная RU/UZ/EN локализация намеренно не менялась.
8. Next.js обновлён до последней стабильной `16.2.12`; обновлены безопасно
   заменяемые зависимости и transitive overrides.
9. Добавлен шифрованный и самопроверяемый production dump pipeline и
   `BACKUP_RUNBOOK.md`.
10. Добавлены regression tests для DB-защит, callback routing, staff overrides
    и mobile drawers.

Итоговая проверка после исправлений:

| Проверка | Результат |
|---|---|
| `npx tsc --noEmit` | успешно |
| `npm run build` | успешно |
| `npm test` | 171 passed, 1 skipped |
| Playwright full suite | 38 passed, 6 skipped |
| Access-control E2E matrix | 36 passed |
| Modified-files ESLint | успешно |
| Production dependency audit | 3 high в транзитивных зависимостях текущего latest Next.js |

Остаются две инфраструктурные задачи, которые нельзя безопасно выполнить только
из кода: подключить секреты и off-site destination к ежедневному backup runner,
а также включить Supabase PITR после выбора оплачиваемого плана. Три оставшиеся
production audit-записи приходят из зависимостей, закреплённых последней
стабильной версией Next.js; принудительный `npm audit fix --force` откатывает
framework на несовместимую версию и поэтому не применялся.
- Удалить raw hex/rgba из 79 активных TSX-файлов и вернуть UI к design tokens.

### Google Calendar и Telegram

- Идемпотентность ручного создания calendar event.
- Сохранять `last_error/status` для Google API операций и показывать пользователю.
- Атомарный claim для client inbox, чтобы cron/manual retry не отправляли дубль.
- Компенсирующий rollback при неудаче DB после смены Telegram webhook.
- Ролевая Mini App для owner/admin/manager/receptionist/cashier/trainer должна иметь единый
  capability contract с web CRM, а не отдельную частично расходящуюся логику.
- Заменить state-changing GET `/api/platform/stop-impersonation` на same-origin POST/Server
  Action.
- Оставить публичный `/api/health` минимальным liveness; DB latency/readiness перенести в
  приватный Platform monitoring.

## Состояние модулей

| Модуль | Состояние | Основной разрыв |
|---|---|---|
| Auth/onboarding | Частично готов | OAuth bypass регистрации/legal, cookie/Mini App regression |
| Dashboard | Работает | нужны loading/error states и проверка метрик на больших данных |
| Клиенты | Работает | tenant-reference hardening и role scoping trainer |
| Абонементы | Работает | `change_price` RBAC и refund lifecycle |
| Посещения | Работает | hardware E2E не подтверждён |
| Расписание | Работает | capability-filter и trainer scope |
| Платежи | Риск | callback atomicity и reconciliation |
| Склад/POS | Работает с риском | duplicate callback и refund compensation |
| Сотрудники/RBAC | Частично готов | индивидуальные права не применяются |
| Удержание | Работает | tenant FK и observability |
| Growth OS/AI | Частично готов | AI permission, usage/cost guardrails |
| Telegram | Частично готов | retries, owner/staff Mini App parity |
| Google Calendar | Базовый manual flow | error persistence и manual idempotency |
| Instagram | Foundation/Beta | нет полноценного processing/sync |
| Турникеты | Beta | нет проверки на реальном железе |
| Platform Admin | Функционально неполон | P0 role escalation, billing consistency, impersonation |
| Backup/DR | Не готов | нет recoverable production backup |

Текущий UX-прогон подтвердил, что dashboard корректно перестраивается в одну колонку без
горизонтального overflow, а Platform Admin сохраняет визуальную целостность на desktop/mobile
и в light/dark. Главные UX-проблемы — accessibility и расхождение заявленной полной
локализации с фактическим SSR/formatting.

## Что уже сделано хорошо

- 71/71 public tables имеют RLS.
- Две независимые QA-сессии подтвердили базовую cross-tenant изоляцию.
- Все проверенные `SECURITY DEFINER` функции имеют фиксированный `search_path`.
- Основные payment/visit/freeze/invite RPC содержат tenant/permission guards.
- Есть DB-trigger против эскалации staff до owner/admin.
- Service-only таблицы интеграций и credentials закрыты от anon/authenticated.
- Платёжные и access-control secrets используют AES-256-GCM и отдельный production key.
- Поиск использует общий sanitizer.
- Сборка и 164 основных теста проходят.
- Owner/reception операционные сценарии и onboarding в целом работоспособны.
- Safe production matrix подтвердил auth gates: закрытые CRM/Platform routes редиректят,
  cron endpoints без секрета отвечают `401`, invalid webhook signatures отклоняются, legacy
  Telegram webhook возвращает `410`.

## Что не хватает относительно сильных конкурентов

Официальные страницы конкурентов показывают общий baseline: автоматический billing/retry,
member self-service и branded app, online waivers, waitlists, kiosk, door access,
multi-location BI, маркетинговые automation и staff app.

Источники:

- [Glofox](https://www.glofox.com/business-types/gym-management-software/)
- [Mindbody](https://www.mindbodyonline.com/)
- [GymMaster](https://www.gymmaster.com/fitness-software/)
- [PushPress Staff App](https://www.pushpress.com/feature-list/staff-app)
- [Virtuagym Access Control](https://business.virtuagym.com/gym-access-control-system/)
- [PerfectGym](https://www.perfectgym.com/en/solutions/gym-management-software)
- [YCLIENTS Fitness](https://www.yclients.com/fitness)

Главные продуктовые пробелы Zalkins:

1. надёжный recurring billing, retry/dunning и reconciliation;
2. production-grade role-aware staff/member Mini App;
3. online waiver/contract с версионированием согласий;
4. waitlist, no-show rules и автоматическое освобождение мест;
5. полноценный marketing automation journey;
6. multi-location consolidated BI и owner alerts;
7. сертифицированные hardware connectors и журнал здоровья устройств;
8. disaster recovery и SLA/incident communication;
9. полноценный API/webhooks для партнёров;
10. audit-friendly финансовое закрытие смены/кассы.

## Защита данных и соответствие требованиям

Supabase применяет shared-responsibility model: шифрование at rest/in transit предоставляется
платформой, но RLS, MFA, backups, PITR, network restrictions и корректная авторизация остаются
ответственностью приложения
([Supabase Shared Responsibility](https://supabase.com/docs/guides/deployment/shared-responsibility-model)).

Для Zalkins необходимы:

- документированная карта данных и классификация PII/финансовых/биометрических данных;
- MFA для Platform Admin и owner;
- off-site backup и restore drill;
- retention/deletion schedule;
- журнал административных действий и экспорта;
- incident response, rotation/revocation secrets;
- DPA со всеми processors и проверка data residency.

Закон Узбекистана о персональных данных требует правовых, организационных и технических мер,
конфиденциальности и прекращения/уничтожения данных при достижении цели или наступлении иных
оснований. Актуальную редакцию и трансграничную передачу необходимо подтвердить местным
юристом перед масштабированием
([LexUZ — Закон «О персональных данных»](https://lex.uz/ru/docs/4396428)).

Production Supabase расположен в Sydney. Если турникеты используют лицо, отпечаток или другие
биометрические шаблоны, их нельзя автоматически забирать в текущую зарубежную архитектуру без
отдельной локализации, явного согласия и юридической проверки. Предпочтительный MVP — хранить
только внешний credential ID карты/браслета, не биометрию.

## Рекомендуемый порядок работ

### Первые 72 часа

1. Закрыть `platform_role` self-update и platform all-club scope.
2. Закрыть изменение billing-полей `clubs`.
3. Отключить/ограничить небезопасное подтверждение онлайн-платежей до атомарного fix.
4. Обновить Next.js и high dependencies.
5. Настроить внеплощадочный backup production.

### 2 недели

1. Атомарные callback/refund/reconciliation.
2. Исправить RBAC и индивидуальные permissions во всех web/Telegram entrypoints.
3. Починить cookie banner Mini App и полный E2E.
4. Включить leaked password protection, MFA для Platform, CSP report-only.
5. Исправить Platform subscription consistency и impersonation.

### 30 дней

1. Durable jobs: leases, retries, dead-letter, per-job monitoring.
2. Tenant-integrity migrations и privacy lifecycle.
3. Role-aware Mini App parity.
4. Instagram довести до честного beta либо скрыть незавершённые обещания.
5. Hardware commissioning checklist и пилот на одном клубе.

### 60–90 дней

1. Recurring billing/dunning и финансовое закрытие.
2. Waivers/contracts, waitlist/no-show, API/webhooks.
3. Multi-location BI и executive owner reports.
4. Полный restore/incident drill и ASVS Level 2 verification
   ([OWASP ASVS](https://devguide.owasp.org/en/06-verification/01-guides/03-asvs/)).

## Release gate

До публичного масштабирования обязательны:

- все P0 закрыты миграциями и regression tests;
- P1 payment/RBAC/backup закрыты;
- E2E Mini App зелёный;
- production restore доказан;
- отсутствуют high dependency advisories;
- выполнен повторный cross-tenant и Platform Admin pentest;
- реальные Click/Payme callback и хотя бы один hardware connector проверены в sandbox/пилоте.
