---
type: ai-handoff
status: active
updated: 2026-07-18
tags: [fitcrm, ai]
---

# AI Handoff

## Читать первым

1. `/AGENTS.md` — критические инженерные правила.
2. [[01 Project Context]] — стабильный контекст.
3. [[02 Current State]] — текущее состояние.
4. [[03 Current Task]] и [[05 Kanban]] — активная работа.
5. `/DESIGN_SYSTEM.md` и профильный ADR/документ для конкретной задачи.

## Краткий контекст

FitCRM — Next.js 16 + React 19 мультитенантная CRM для фитнес-клубов Узбекистана. Данные, Auth, RLS, Realtime и Storage находятся в Supabase; приложение — Vercel. Prisma/tRPC отсутствуют.

## Текущая задача

<!-- AUTO:START current-task -->
Нет активной задачи. Выберите следующую из [[05 Kanban]].
<!-- AUTO:END current-task -->

## Последние существенные изменения

<!-- AUTO:START recent-changes -->
- `a7d8cb9` · 2026-07-24 · Align client profile layout
- `31bb9b2` · 2026-07-24 · Redesign client profile actions
- `7c62e94` · 2026-07-24 · fix: align Google Calendar with CRM design system
- `d09144f` · 2026-07-24 · docs: record Google Calendar release [skip ci]
- `694842c` · 2026-07-24 · feat: add controlled Google Calendar workspace
- `e8de0e4` · 2026-07-24 · feat: add Google Calendar integration
- `df0517f` · 2026-07-24 · feat: group integration catalog sections
- `dff8246` · 2026-07-23 · fix: expose bridge release download
- `550b27e` · 2026-07-23 · feat: ship access control bridge
- `836dcb3` · 2026-07-23 · feat: add access control integrations
<!-- AUTO:END recent-changes -->

## Известные проблемы

- Vercel `syd1` и Supabase `ap-southeast-2` подтверждены как Sydney-регионы; cold latency остаётся под наблюдением.
- Unit/integration и opt-in tenant isolation тесты существуют локально; автоматический GitHub CI пока не подключён.
- SMS/email delivery и проверенный backup/restore отсутствуют.
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
2026-07-24 Asia/Tashkent
<!-- AUTO:END updated-at -->
