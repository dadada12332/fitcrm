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
[[03 Current Task]] — TASK-0004, status `blocked`: Провести backup/restore drill.
<!-- AUTO:END current-task -->

## Последние существенные изменения

<!-- AUTO:START recent-changes -->
- `2e3e312` · 2026-07-19 · Add authenticated local QA gate
- `abd37f0` · 2026-07-19 · Record verified dashboard production deploy [skip ci]
- `09d44d7` · 2026-07-19 · Fix dashboard icon and Windows knowledge sync
- `8c32036` · 2026-07-18 · Document landing overview refresh [skip ci]
- `f78622e` · 2026-07-18 · Polish landing platform overview
- `699ac9f` · 2026-07-18 · Document Obsidian productivity plugins [skip ci]
- `62a645a` · 2026-07-18 · Configure Obsidian Kanban and Calendar [skip ci]
- `9c6d5a6` · 2026-07-18 · Document AI page spacing fix [skip ci]
- `2628a08` · 2026-07-18 · Align AI analytics page spacing
- `1610389` · 2026-07-18 · Document Telegram client identity model [skip ci]
<!-- AUTO:END recent-changes -->

## Известные проблемы

- Регион Supabase не подтверждён при Vercel `syd1`.
- Нет unit/integration CI и автоматических tenant isolation тестов.
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
- QA credentials существуют только локально и не должны попадать в Git, knowledge, Obsidian или вывод команд.

## Источники истины

Код → реализация; миграции → БД; Git → история; Figma/`DESIGN_SYSTEM.md` → UI; Current State → оперативный статус; ADR → причины решений; Kanban → работа.

## Не предполагать без проверки

Production deploy, применённые миграции, регион Supabase, наличие провайдеров и точные пути из старых `FITCRM_*` документов.

Последнее автоматическое обновление: <!-- AUTO:START updated-at -->
2026-07-19 Asia/Tashkent
<!-- AUTO:END updated-at -->
