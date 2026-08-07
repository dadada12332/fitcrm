---
type: ai-handoff
status: active
updated: 2026-08-07
tags: [zalkins, ai]
---

# AI Handoff

## Читать первым

1. `/AGENTS.md` — критические инженерные правила.
2. [[01 Project Context]] — стабильный контекст.
3. [[02 Current State]] — текущее состояние.
4. [[03 Current Task]] и [[05 Kanban]] — активная работа.
5. `/DESIGN_SYSTEM.md` и профильный ADR/документ для конкретной задачи.

## Краткий контекст

Zalkins — Next.js 16 + React 19 мультитенантная CRM для фитнес-клубов Узбекистана. Данные,
Auth, RLS, Realtime и Storage находятся в Supabase; приложение — Vercel. Prisma/tRPC отсутствуют.
Репозиторий, legacy lowercase identifiers и текущий production alias пока сохраняют имя `fitcrm`
для обратной совместимости.

## Текущая задача

<!-- AUTO:START current-task -->
Нет активной задачи. Выберите следующую из [[05 Kanban]].
<!-- AUTO:END current-task -->

## Production release — Lead Hub 2026-08-07

- `/leads` реализует отдельный pre-client pipeline с источниками, этапами, owner, SLA,
  next action, trial, loss/reopen, immutable timeline/archive и атомарной конвертацией.
- Миграции `20260805075601_lead_hub_foundation.sql` и
  `20260807115921_lead_hub_client_integrity.sql` применены; tenant isolation строится на
  `club_id`, мутации service-only и дополнительно permission-checked в Server Actions.
- Конвертированный клиент защищён `NOT NULL` + `ON DELETE RESTRICT`, а клиентский delete action
  заранее возвращает понятную ошибку. Impersonation на мутациях закрыт fail-closed.
- Локальный browser QA подтвердил основной lifecycle, duplicate/quota guards, responsive
  desktop/mobile, light/dark и отсутствие console/horizontal-overflow ошибок.
- Финальный release gate 2026-08-07 чистый: TypeScript, scoped ESLint, 259 тестов
  (1 skipped), `git diff --check` и production build с 66/66 сгенерированными страницами.
- Commit `6afe4ee`, deployment `dpl_JEK2bkzdKGYgWQ8jWD2caLakAZ7r`, основной alias
  `fitcrm-three.vercel.app`. Health/database, auth redirect, authorized desktop/mobile browser QA,
  zero-overflow, Onest, console и Vercel error/fatal/500 scan подтверждены.

## Production release — renewal lifecycle 2026-08-04

- Renewal lifecycle реализован и локально проверен: `active`/`expiring`/`expired`/`trial_*`/
  `unlimited`/`suspended`, предупреждение за 7 дней, CRM + Telegram milestones 7/3/1/0/overdue,
  recovery-shell «Подписка» + «Поддержка», продление того же тарифа и отдельный pending-state.
- Коммерческие terms заявки неизменяемы; approval и связанные platform-операции атомарны;
  app, RLS/DB triggers и Storage fail-closed блокируют операционный доступ после expiry.
- Пройдены 213 тестов (1 skipped), TypeScript, scoped ESLint, production build, SQL parse/runtime
  rollback-сценарии и security review без Critical/High/Medium замечаний.
- Production rollout завершён в порядке expand → app `READY` → contract. Commit `0551fa5`,
  deployment `dpl_DS1d4bbectKbM2hrWJNWDEDQqHpr`; alias, health/smoke, DB triggers/ACL,
  expired/pending/approve recovery и Vercel error scan подтверждены. Approval freeze снята.
  Не применять expand повторно после contract.
- Полный flow, screenshots и evidence limits: [[UX/Subscription Renewal Audit 2026-08-04]].
- Остаточный Low: Telegram reminders имеют at-least-once семантику и могут повториться в узком
  окне «Telegram принял сообщение, запись статуса в БД не удалась».

## Последние существенные изменения

<!-- AUTO:START recent-changes -->
- `6afe4ee` · 2026-08-07 · feat: add secure lead sales hub
- `0175c90` · 2026-08-04 · docs: record subscription lifecycle release [skip ci]
- `0551fa5` · 2026-08-04 · fix: harden subscription renewal lifecycle
- `508ac53` · 2026-07-30 · docs: record audit remediation release [skip ci]
- `0470167` · 2026-07-30 · fix: harden platform billing and access flows
- `86e7cd6` · 2026-07-30 · docs: record membership chevron QA [skip ci]
- `f20a71a` · 2026-07-30 · fix: align membership duration chevron
- `8f514a4` · 2026-07-30 · docs: record dashboard border QA [skip ci]
- `933fafe` · 2026-07-30 · fix: remove doubled dashboard chart border
- `6466723` · 2026-07-30 · docs: record membership freeze release [skip ci]
<!-- AUTO:END recent-changes -->

## Известные проблемы

- Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы; cold latency остаётся под наблюдением.
- Unit/integration и opt-in tenant isolation тесты существуют локально; автоматический GitHub CI пока не подключён.
- SMS/email delivery и проверенный backup/restore отсутствуют.
- Renewal lifecycle live и production-проверен; при будущих изменениях сохранять rollout-contract
  и не переустанавливать expand поверх действующего contract.
- Подробнее: [[08 Known Issues]].

## Нельзя нарушать

- Каждая мутирующая Server Action проверяет `getCurrentClub()` и `can(...)`.
- `createServiceClient()` требует ручного `clubId` scope.
- `.or(...ilike...)` использует `sanitizeSearchTerm()`.
- UI использует дизайн-токены и `src/components/ui/`; пути всегда проверяются по коду.
- Не логировать и не сохранять секреты или клиентские данные.
- Не считать deploy/tests успешными без фактической проверки.

## UI QA gate

- Для UI-задач сначала проверять localhost авторизованным синтетическим QA-пользователем в отдельном клубе без клиентских данных.
- Проверять сценарий, framework overlay, browser/server errors и фактический визуальный результат; затем запускать TypeScript, релевантные тесты и build.
- Push в `main` выполнять только после успешной локальной проверки, затем проверять production deployment.
- В финальном отчёте по каждой UI-правке, включая небольшую, прикладывать актуальный screenshot из проверенного приложения; для responsive-правок показывать desktop и mobile отдельно.
- QA credentials существуют только локально и не должны попадать в Git, knowledge, Obsidian или вывод команд.

## Источники истины

Код → реализация; миграции → БД; Git → история; Figma/`DESIGN_SYSTEM.md` → UI; Current State → оперативный статус; ADR → причины решений; Kanban → работа.

## Не предполагать без проверки

Production deploy, применённые миграции, регион Supabase, наличие провайдеров и точные пути из старых `FITCRM_*` документов.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-08-07 Asia/Tashkent
<!-- AUTO:END updated-at -->
