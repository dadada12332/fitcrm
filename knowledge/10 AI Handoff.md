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
- `63d1989` · 2026-07-20 · feat: add retention AI copilot
- `bc10d6d` · 2026-07-20 · docs: retire resolved launch issues [skip ci]
- `7716f9d` · 2026-07-20 · docs: record verified production hardening [skip ci]
- `6e4e494` · 2026-07-20 · perf: harden CRM runtime and production checks
- `ac1a6fe` · 2026-07-20 · Record verified launch readiness status
- `7a01d28` · 2026-07-20 · Harden launch-critical flows and infrastructure
- `f81cc0b` · 2026-07-19 · Record verified active tab deployment [skip ci]
- `ca1bc08` · 2026-07-19 · Fix Growth OS active tab styling
- `3fdf562` · 2026-07-19 · Record verified Growth OS production release [skip ci]
- `0514d3d` · 2026-07-19 · Release retention center and Growth OS
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
2026-07-20 Asia/Tashkent
<!-- AUTO:END updated-at -->
